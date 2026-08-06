-- Correções pós-implantação: integridade, recorrência e operações seguras.

CREATE TABLE public.billing_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, source_key)
);

GRANT SELECT, INSERT, DELETE ON public.billing_suppressions TO authenticated;
GRANT ALL ON public.billing_suppressions TO service_role;
ALTER TABLE public.billing_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own billing suppressions" ON public.billing_suppressions FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- Programas removidos são arquivados, não apagados; a unicidade vale só para ativos.
ALTER TABLE public.student_programs
  DROP CONSTRAINT IF EXISTS student_programs_student_id_instrument_key;
CREATE UNIQUE INDEX IF NOT EXISTS student_programs_active_instrument_unique_idx
  ON public.student_programs(student_id, instrument) WHERE active;

ALTER TABLE public.student_programs
  ADD CONSTRAINT student_programs_billing_fields_check CHECK (
    NOT active OR (
      (billing_type <> 'pacote' OR package_lessons IS NOT NULL)
      AND (NOT auto_billing OR billing_type = 'mensalidade')
    )
  ) NOT VALID;

-- Avaliações individuais acompanham a participação da aula.
DELETE FROM public.lesson_reports report
WHERE report.scope = 'individual'
  AND NOT EXISTS (
    SELECT 1 FROM public.lesson_participants participant
    WHERE participant.lesson_id = report.lesson_id
      AND participant.student_id = report.student_id
  );

ALTER TABLE public.lesson_reports
  ADD CONSTRAINT lesson_reports_participant_fkey
  FOREIGN KEY (lesson_id, student_id)
  REFERENCES public.lesson_participants(lesson_id, student_id)
  ON DELETE CASCADE;

UPDATE public.lesson_participants participant
SET attendance = 'presente'
FROM public.lessons lesson
WHERE lesson.id = participant.lesson_id
  AND lesson.status = 'realizada'
  AND participant.attendance = 'pendente';

CREATE OR REPLACE FUNCTION public.generate_monthly_charges(p_competence DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
  local_today DATE;
  target_month DATE;
BEGIN
  SELECT (now() AT TIME ZONE COALESCE(profile.timezone, 'America/Sao_Paulo'))::date
  INTO local_today
  FROM public.profiles profile
  WHERE profile.id = auth.uid();

  local_today := COALESCE(local_today, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  target_month := LEAST(
    date_trunc('month', p_competence)::date,
    date_trunc('month', local_today)::date
  );

  UPDATE public.financial_transactions
  SET status = 'atrasado'
  WHERE teacher_id = auth.uid()
    AND status = 'pendente'
    AND due_date < local_today;

  INSERT INTO public.financial_transactions (
    teacher_id, student_id, student_program_id, student_name, description,
    amount, type, category, status, payment_method, competence_date, due_date, source_key
  )
  SELECT
    program.teacher_id,
    program.student_id,
    program.id,
    student.name,
    'Mensalidade - ' || program.instrument,
    program.amount,
    'receita',
    'mensalidade',
    'pendente',
    'pix',
    month_series.competence,
    month_series.competence + (COALESCE(program.due_day, 5) - 1),
    'mensalidade:' || program.id::text || ':' || to_char(month_series.competence, 'YYYY-MM')
  FROM public.student_programs program
  JOIN public.students student ON student.id = program.student_id
  CROSS JOIN LATERAL (
    SELECT generate_series(
      date_trunc('month', program.created_at)::date,
      target_month,
      interval '1 month'
    )::date AS competence
  ) month_series
  WHERE program.teacher_id = auth.uid()
    AND program.active
    AND student.status = 'ativo'
    AND program.auto_billing
    AND program.billing_type = 'mensalidade'
    AND program.amount IS NOT NULL
    AND program.amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.billing_suppressions suppression
      WHERE suppression.teacher_id = program.teacher_id
        AND suppression.source_key =
          'mensalidade:' || program.id::text || ':' || to_char(month_series.competence, 'YYYY-MM')
    )
  ON CONFLICT (teacher_id, source_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_financial_transaction(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  transaction_source TEXT;
BEGIN
  SELECT source_key INTO transaction_source
  FROM public.financial_transactions
  WHERE id = p_id AND teacher_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;

  IF transaction_source LIKE 'mensalidade:%' THEN
    INSERT INTO public.billing_suppressions (teacher_id, source_key)
    VALUES (auth.uid(), transaction_source)
    ON CONFLICT (teacher_id, source_key) DO NOTHING;
  END IF;

  DELETE FROM public.financial_transactions
  WHERE id = p_id AND teacher_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.save_student_with_programs(
  p_student JSONB,
  p_programs JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := NULLIF(p_student->>'id', '')::uuid;
  v_program JSONB;
  v_program_id UUID;
  primary_count INTEGER;
BEGIN
  IF p_student IS NULL OR jsonb_typeof(p_student) <> 'object' THEN
    RAISE EXCEPTION 'Dados do aluno inválidos.';
  END IF;
  IF p_programs IS NULL OR jsonb_typeof(p_programs) <> 'array'
     OR jsonb_array_length(p_programs) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um instrumento.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_programs) item
    WHERE jsonb_typeof(item) <> 'object' OR NULLIF(item->>'instrument', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Instrumento inválido.';
  END IF;

  SELECT count(*) INTO primary_count
  FROM jsonb_array_elements(p_programs) item
  WHERE COALESCE((item->>'is_primary')::boolean, false);
  IF primary_count <> 1 THEN RAISE EXCEPTION 'Defina exatamente um instrumento principal.'; END IF;

  IF v_student_id IS NULL THEN
    INSERT INTO public.students (
      teacher_id, name, whatsapp, email, instrument, goal, notes, status,
      default_weekday, default_time, default_duration, default_lesson_type,
      default_location, photo_url
    ) VALUES (
      auth.uid(), p_student->>'name', NULLIF(p_student->>'whatsapp', ''),
      NULLIF(p_student->>'email', ''), p_student->>'instrument', NULLIF(p_student->>'goal', ''),
      NULLIF(p_student->>'notes', ''),
      COALESCE(NULLIF(p_student->>'status', ''), 'ativo')::public.student_status,
      NULLIF(p_student->>'default_weekday', '')::smallint,
      NULLIF(p_student->>'default_time', '')::time,
      COALESCE(NULLIF(p_student->>'default_duration', '')::smallint, 60),
      COALESCE(NULLIF(p_student->>'default_lesson_type', ''), 'presencial')::public.lesson_type,
      NULLIF(p_student->>'default_location', ''), NULLIF(p_student->>'photo_url', '')
    ) RETURNING id INTO v_student_id;
  ELSE
    UPDATE public.students SET
      name = p_student->>'name', whatsapp = NULLIF(p_student->>'whatsapp', ''),
      email = NULLIF(p_student->>'email', ''), instrument = p_student->>'instrument',
      goal = NULLIF(p_student->>'goal', ''), notes = NULLIF(p_student->>'notes', ''),
      status = COALESCE(NULLIF(p_student->>'status', ''), 'ativo')::public.student_status,
      default_weekday = NULLIF(p_student->>'default_weekday', '')::smallint,
      default_time = NULLIF(p_student->>'default_time', '')::time,
      default_duration = COALESCE(NULLIF(p_student->>'default_duration', '')::smallint, 60),
      default_lesson_type = COALESCE(NULLIF(p_student->>'default_lesson_type', ''), 'presencial')::public.lesson_type,
      default_location = NULLIF(p_student->>'default_location', ''),
      photo_url = NULLIF(p_student->>'photo_url', '')
    WHERE id = v_student_id AND teacher_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não encontrado.'; END IF;
  END IF;

  UPDATE public.student_programs SET active = false, is_primary = false
  WHERE student_id = v_student_id;

  FOR v_program IN SELECT value FROM jsonb_array_elements(p_programs)
  LOOP
    v_program_id := NULLIF(v_program->>'id', '')::uuid;
    IF v_program_id IS NULL THEN
      INSERT INTO public.student_programs (
        teacher_id, student_id, instrument, is_primary, level, goal, billing_type,
        amount, due_day, package_lessons, auto_billing, active
      ) VALUES (
        auth.uid(), v_student_id, v_program->>'instrument',
        COALESCE((v_program->>'is_primary')::boolean, false), NULLIF(v_program->>'level', ''),
        NULLIF(v_program->>'goal', ''), v_program->>'billing_type',
        NULLIF(v_program->>'amount', '')::numeric, NULLIF(v_program->>'due_day', '')::smallint,
        NULLIF(v_program->>'package_lessons', '')::smallint,
        COALESCE((v_program->>'auto_billing')::boolean, false), true
      );
    ELSE
      UPDATE public.student_programs SET
        instrument = v_program->>'instrument',
        is_primary = COALESCE((v_program->>'is_primary')::boolean, false),
        level = NULLIF(v_program->>'level', ''), goal = NULLIF(v_program->>'goal', ''),
        billing_type = v_program->>'billing_type', amount = NULLIF(v_program->>'amount', '')::numeric,
        due_day = NULLIF(v_program->>'due_day', '')::smallint,
        package_lessons = NULLIF(v_program->>'package_lessons', '')::smallint,
        auto_billing = COALESCE((v_program->>'auto_billing')::boolean, false), active = true
      WHERE id = v_program_id AND student_id = v_student_id AND teacher_id = auth.uid();
      IF NOT FOUND THEN RAISE EXCEPTION 'Instrumento não encontrado.'; END IF;
    END IF;
  END LOOP;

  RETURN v_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_lesson_with_participants(
  p_lesson_id UUID,
  p_lesson JSONB,
  p_participants JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lesson_id UUID := p_lesson_id;
  v_participant JSONB;
BEGIN
  IF p_lesson IS NULL OR jsonb_typeof(p_lesson) <> 'object' THEN
    RAISE EXCEPTION 'Dados da aula inválidos.';
  END IF;
  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array'
     OR jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um aluno.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_participants) item
    WHERE jsonb_typeof(item) <> 'object' OR NULLIF(item->>'student_id', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Participante inválido.';
  END IF;

  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      teacher_id, student_id, starts_at, duration_minutes, lesson_type, status, location, notes
    ) VALUES (
      auth.uid(), (p_participants->0->>'student_id')::uuid,
      (p_lesson->>'starts_at')::timestamptz, (p_lesson->>'duration_minutes')::smallint,
      (p_lesson->>'lesson_type')::public.lesson_type,
      COALESCE(NULLIF(p_lesson->>'status', ''), 'agendada')::public.lesson_status,
      NULLIF(p_lesson->>'location', ''), NULLIF(p_lesson->>'notes', '')
    ) RETURNING id INTO v_lesson_id;
  ELSE
    UPDATE public.lessons SET
      student_id = (p_participants->0->>'student_id')::uuid,
      starts_at = (p_lesson->>'starts_at')::timestamptz,
      duration_minutes = (p_lesson->>'duration_minutes')::smallint,
      lesson_type = (p_lesson->>'lesson_type')::public.lesson_type,
      status = (p_lesson->>'status')::public.lesson_status,
      location = NULLIF(p_lesson->>'location', ''), notes = NULLIF(p_lesson->>'notes', '')
    WHERE id = v_lesson_id AND teacher_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Aula não encontrada.'; END IF;
  END IF;

  FOR v_participant IN SELECT value FROM jsonb_array_elements(p_participants)
  LOOP
    INSERT INTO public.lesson_participants (teacher_id, lesson_id, student_id, student_program_id)
    VALUES (
      auth.uid(), v_lesson_id, (v_participant->>'student_id')::uuid,
      NULLIF(v_participant->>'student_program_id', '')::uuid
    )
    ON CONFLICT (lesson_id, student_id) DO UPDATE SET
      student_program_id = EXCLUDED.student_program_id;
  END LOOP;

  DELETE FROM public.lesson_participants participant
  WHERE participant.lesson_id = v_lesson_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_participants) item
      WHERE (item->>'student_id')::uuid = participant.student_id
    );

  RETURN v_lesson_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_lesson_assessments(
  p_lesson_id UUID,
  p_general JSONB,
  p_individuals JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_report_id UUID;
  v_participant_count INTEGER;
  v_lesson_status public.lesson_status;
  v_starts_at TIMESTAMPTZ;
BEGIN
  IF p_general IS NULL OR jsonb_typeof(p_general) <> 'object' THEN
    RAISE EXCEPTION 'Relatório geral inválido.';
  END IF;
  IF p_individuals IS NULL OR jsonb_typeof(p_individuals) <> 'array' THEN
    RAISE EXCEPTION 'Avaliações individuais inválidas.';
  END IF;

  SELECT status, starts_at INTO v_lesson_status, v_starts_at
  FROM public.lessons WHERE id = p_lesson_id AND teacher_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Aula não encontrada.'; END IF;
  IF v_lesson_status = 'cancelada' THEN RAISE EXCEPTION 'Uma aula cancelada não pode ser finalizada.'; END IF;
  IF v_starts_at > now() THEN RAISE EXCEPTION 'Uma aula futura não pode ser finalizada.'; END IF;

  SELECT count(*) INTO v_participant_count
  FROM public.lesson_participants WHERE lesson_id = p_lesson_id;
  IF (
    SELECT count(DISTINCT (item->>'student_id')::uuid)
    FROM jsonb_array_elements(p_individuals) item
  ) <> v_participant_count THEN
    RAISE EXCEPTION 'Avalie todos os participantes antes de finalizar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_individuals) item
    WHERE NULLIF(item->>'student_id', '') IS NULL
      OR COALESCE(item->>'attendance', 'pendente') = 'pendente'
      OR NOT EXISTS (
        SELECT 1 FROM public.lesson_participants participant
        WHERE participant.lesson_id = p_lesson_id
          AND participant.student_id = (item->>'student_id')::uuid
      )
  ) THEN
    RAISE EXCEPTION 'Confirme a presença de todos os participantes.';
  END IF;

  SELECT id INTO v_report_id FROM public.lesson_reports
  WHERE lesson_id = p_lesson_id AND scope = 'geral';
  IF v_report_id IS NULL THEN
    INSERT INTO public.lesson_reports (teacher_id, lesson_id, student_id, scope, content, exercises, notes)
    VALUES (
      auth.uid(), p_lesson_id, NULL, 'geral', NULLIF(p_general->>'content', ''),
      NULLIF(p_general->>'exercises', ''), NULLIF(p_general->>'notes', '')
    );
  ELSE
    UPDATE public.lesson_reports SET
      content = NULLIF(p_general->>'content', ''), exercises = NULLIF(p_general->>'exercises', ''),
      notes = NULLIF(p_general->>'notes', '')
    WHERE id = v_report_id AND teacher_id = auth.uid();
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_individuals)
  LOOP
    v_report_id := NULL;
    SELECT id INTO v_report_id FROM public.lesson_reports
    WHERE lesson_id = p_lesson_id AND student_id = (v_item->>'student_id')::uuid
      AND scope = 'individual';
    IF v_report_id IS NULL THEN
      INSERT INTO public.lesson_reports (teacher_id, lesson_id, student_id, scope, content, exercises, notes)
      VALUES (
        auth.uid(), p_lesson_id, (v_item->>'student_id')::uuid, 'individual',
        NULLIF(v_item->>'content', ''), NULLIF(v_item->>'exercises', ''),
        NULLIF(v_item->>'notes', '')
      );
    ELSE
      UPDATE public.lesson_reports SET
        content = NULLIF(v_item->>'content', ''), exercises = NULLIF(v_item->>'exercises', ''),
        notes = NULLIF(v_item->>'notes', '')
      WHERE id = v_report_id AND teacher_id = auth.uid();
    END IF;
    UPDATE public.lesson_participants SET attendance = v_item->>'attendance'
    WHERE lesson_id = p_lesson_id AND student_id = (v_item->>'student_id')::uuid
      AND teacher_id = auth.uid();
  END LOOP;

  UPDATE public.lessons SET status = 'realizada'
  WHERE id = p_lesson_id AND teacher_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_monthly_charges(DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_financial_transaction(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_student_with_programs(JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_lesson_with_participants(UUID, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_lesson_assessments(UUID, JSONB, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_monthly_charges(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_financial_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_with_programs(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lesson_with_participants(UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lesson_assessments(UUID, JSONB, JSONB) TO authenticated;
