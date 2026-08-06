-- Instrumentos, planos e condições financeiras por aluno
CREATE TABLE public.student_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  level TEXT,
  goal TEXT,
  billing_type TEXT NOT NULL DEFAULT 'mensalidade'
    CHECK (billing_type IN ('mensalidade', 'aula_avulsa', 'pacote')),
  amount NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
  due_day SMALLINT CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 28),
  package_lessons SMALLINT CHECK (package_lessons IS NULL OR package_lessons > 0),
  auto_billing BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, instrument)
);

CREATE INDEX student_programs_teacher_idx ON public.student_programs(teacher_id);
CREATE INDEX student_programs_student_idx ON public.student_programs(student_id);
CREATE UNIQUE INDEX student_programs_one_primary_idx
  ON public.student_programs(student_id) WHERE is_primary;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_programs TO authenticated;
GRANT ALL ON public.student_programs TO service_role;
ALTER TABLE public.student_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own student programs" ON public.student_programs FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER student_programs_updated BEFORE UPDATE ON public.student_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.student_programs (
  teacher_id, student_id, instrument, is_primary, goal, billing_type, auto_billing
)
SELECT teacher_id, id, instrument, true, goal, 'mensalidade', true
FROM public.students
WHERE trim(instrument) <> ''
ON CONFLICT (student_id, instrument) DO NOTHING;

-- Participantes permitem aulas individuais ou coletivas sem duplicar a sessão.
CREATE TABLE public.lesson_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_program_id UUID REFERENCES public.student_programs(id) ON DELETE SET NULL,
  attendance TEXT NOT NULL DEFAULT 'pendente'
    CHECK (attendance IN ('pendente', 'presente', 'ausente', 'justificado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);

CREATE INDEX lesson_participants_teacher_idx ON public.lesson_participants(teacher_id);
CREATE INDEX lesson_participants_lesson_idx ON public.lesson_participants(lesson_id);
CREATE INDEX lesson_participants_student_idx ON public.lesson_participants(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_participants TO authenticated;
GRANT ALL ON public.lesson_participants TO service_role;
ALTER TABLE public.lesson_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lesson participants" ON public.lesson_participants FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

INSERT INTO public.lesson_participants (teacher_id, lesson_id, student_id, student_program_id)
SELECT
  l.teacher_id,
  l.id,
  l.student_id,
  (
    SELECT sp.id
    FROM public.student_programs sp
    WHERE sp.student_id = l.student_id
    ORDER BY sp.is_primary DESC, sp.created_at
    LIMIT 1
  )
FROM public.lessons l
WHERE l.student_id IS NOT NULL
ON CONFLICT (lesson_id, student_id) DO NOTHING;

-- Uma aula pode ter um relatório geral e uma avaliação por participante.
ALTER TABLE public.lesson_reports
  DROP CONSTRAINT IF EXISTS lesson_reports_lesson_id_key;
ALTER TABLE public.lesson_reports
  ADD COLUMN scope TEXT;

UPDATE public.lesson_reports
SET scope = CASE WHEN student_id IS NULL THEN 'geral' ELSE 'individual' END;

ALTER TABLE public.lesson_reports
  ALTER COLUMN scope SET DEFAULT 'individual',
  ALTER COLUMN scope SET NOT NULL,
  ADD CONSTRAINT lesson_reports_scope_check CHECK (scope IN ('geral', 'individual')),
  ADD CONSTRAINT lesson_reports_scope_student_check CHECK (
    (scope = 'geral' AND student_id IS NULL) OR
    (scope = 'individual' AND student_id IS NOT NULL)
  );

CREATE UNIQUE INDEX lesson_reports_general_unique_idx
  ON public.lesson_reports(lesson_id) WHERE scope = 'geral';
CREATE UNIQUE INDEX lesson_reports_individual_unique_idx
  ON public.lesson_reports(lesson_id, student_id) WHERE scope = 'individual';

-- Financeiro persistente e sincronizado no Supabase.
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_program_id UUID REFERENCES public.student_programs(id) ON DELETE SET NULL,
  student_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  category TEXT NOT NULL CHECK (
    category IN ('mensalidade', 'aula_avulsa', 'pacote', 'equipamento', 'outros')
  ),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pago', 'pendente', 'atrasado')),
  payment_method TEXT NOT NULL DEFAULT 'pix'
    CHECK (payment_method IN ('pix', 'dinheiro', 'cartao', 'transferencia')),
  competence_date DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, source_key)
);

CREATE INDEX financial_transactions_teacher_competence_idx
  ON public.financial_transactions(teacher_id, competence_date);
CREATE INDEX financial_transactions_student_idx
  ON public.financial_transactions(student_id);
CREATE INDEX financial_transactions_due_idx
  ON public.financial_transactions(teacher_id, due_date, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own financial transactions" ON public.financial_transactions FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER financial_transactions_updated BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_monthly_charges(p_competence DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
  month_start DATE := date_trunc('month', p_competence)::date;
BEGIN
  UPDATE public.financial_transactions
  SET status = 'atrasado'
  WHERE teacher_id = auth.uid()
    AND status = 'pendente'
    AND due_date < CURRENT_DATE;

  INSERT INTO public.financial_transactions (
    teacher_id,
    student_id,
    student_program_id,
    student_name,
    description,
    amount,
    type,
    category,
    status,
    payment_method,
    competence_date,
    due_date,
    source_key
  )
  SELECT
    sp.teacher_id,
    sp.student_id,
    sp.id,
    s.name,
    'Mensalidade - ' || sp.instrument,
    sp.amount,
    'receita',
    'mensalidade',
    'pendente',
    'pix',
    month_start,
    month_start + (COALESCE(sp.due_day, 5) - 1),
    'mensalidade:' || sp.id::text || ':' || to_char(month_start, 'YYYY-MM')
  FROM public.student_programs sp
  JOIN public.students s ON s.id = sp.student_id
  WHERE sp.teacher_id = auth.uid()
    AND sp.active
    AND sp.auto_billing
    AND sp.billing_type = 'mensalidade'
    AND sp.amount IS NOT NULL
    AND sp.amount > 0
  ON CONFLICT (teacher_id, source_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_monthly_charges(DATE) TO authenticated;

-- A FK antiga usava SET NULL, incompatível com avaliações individuais.
ALTER TABLE public.lesson_reports DROP CONSTRAINT IF EXISTS lesson_reports_student_id_fkey;
ALTER TABLE public.lesson_reports
  ADD CONSTRAINT lesson_reports_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Reforça propriedade e coerência das referências nas tabelas relacionais.
DROP POLICY "own student programs" ON public.student_programs;
CREATE POLICY "own student programs" ON public.student_programs FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.teacher_id = auth.uid()
    )
  );

DROP POLICY "own lesson participants" ON public.lesson_participants;
CREATE POLICY "own lesson participants" ON public.lesson_participants FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND l.teacher_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.teacher_id = auth.uid()
    )
    AND (
      student_program_id IS NULL OR EXISTS (
        SELECT 1 FROM public.student_programs sp
        WHERE sp.id = student_program_id
          AND sp.student_id = lesson_participants.student_id
          AND sp.teacher_id = auth.uid()
      )
    )
  );

DROP POLICY "own reports" ON public.lesson_reports;
CREATE POLICY "own reports" ON public.lesson_reports FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND l.teacher_id = auth.uid()
    )
    AND (
      student_id IS NULL OR (
        EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = student_id AND s.teacher_id = auth.uid()
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.lesson_participants lp
            WHERE lp.lesson_id = lesson_reports.lesson_id
              AND lp.student_id = lesson_reports.student_id
          )
          OR EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_reports.lesson_id
              AND l.student_id = lesson_reports.student_id
              AND l.teacher_id = auth.uid()
          )
        )
      )
    )
  );

DROP POLICY "own financial transactions" ON public.financial_transactions;
CREATE POLICY "own financial transactions" ON public.financial_transactions FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      student_id IS NULL OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_id AND s.teacher_id = auth.uid()
      )
    )
    AND (
      student_program_id IS NULL OR EXISTS (
        SELECT 1 FROM public.student_programs sp
        WHERE sp.id = student_program_id
          AND (
            financial_transactions.student_id IS NULL OR
            sp.student_id = financial_transactions.student_id
          )
          AND sp.teacher_id = auth.uid()
      )
    )
  );

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
BEGIN
  IF jsonb_array_length(p_programs) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um instrumento.';
  END IF;

  IF v_student_id IS NULL THEN
    INSERT INTO public.students (
      teacher_id, name, whatsapp, email, instrument, goal, notes, status,
      default_weekday, default_time, default_duration, default_lesson_type,
      default_location, photo_url
    ) VALUES (
      auth.uid(),
      p_student->>'name',
      NULLIF(p_student->>'whatsapp', ''),
      NULLIF(p_student->>'email', ''),
      p_student->>'instrument',
      NULLIF(p_student->>'goal', ''),
      NULLIF(p_student->>'notes', ''),
      COALESCE(NULLIF(p_student->>'status', ''), 'ativo')::public.student_status,
      NULLIF(p_student->>'default_weekday', '')::smallint,
      NULLIF(p_student->>'default_time', '')::time,
      COALESCE(NULLIF(p_student->>'default_duration', '')::smallint, 60),
      COALESCE(NULLIF(p_student->>'default_lesson_type', ''), 'presencial')::public.lesson_type,
      NULLIF(p_student->>'default_location', ''),
      NULLIF(p_student->>'photo_url', '')
    ) RETURNING id INTO v_student_id;
  ELSE
    UPDATE public.students SET
      name = p_student->>'name',
      whatsapp = NULLIF(p_student->>'whatsapp', ''),
      email = NULLIF(p_student->>'email', ''),
      instrument = p_student->>'instrument',
      goal = NULLIF(p_student->>'goal', ''),
      notes = NULLIF(p_student->>'notes', ''),
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

  DELETE FROM public.student_programs sp
  WHERE sp.student_id = v_student_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_programs) item
      WHERE NULLIF(item->>'id', '')::uuid = sp.id
    );

  UPDATE public.student_programs SET is_primary = false WHERE student_id = v_student_id;

  FOR v_program IN SELECT value FROM jsonb_array_elements(p_programs)
  LOOP
    v_program_id := NULLIF(v_program->>'id', '')::uuid;
    IF v_program_id IS NULL THEN
      INSERT INTO public.student_programs (
        teacher_id, student_id, instrument, is_primary, level, goal, billing_type,
        amount, due_day, package_lessons, auto_billing, active
      ) VALUES (
        auth.uid(), v_student_id, v_program->>'instrument',
        COALESCE((v_program->>'is_primary')::boolean, false),
        NULLIF(v_program->>'level', ''), NULLIF(v_program->>'goal', ''),
        v_program->>'billing_type', NULLIF(v_program->>'amount', '')::numeric,
        NULLIF(v_program->>'due_day', '')::smallint,
        NULLIF(v_program->>'package_lessons', '')::smallint,
        COALESCE((v_program->>'auto_billing')::boolean, false),
        COALESCE((v_program->>'active')::boolean, true)
      );
    ELSE
      UPDATE public.student_programs SET
        instrument = v_program->>'instrument',
        is_primary = COALESCE((v_program->>'is_primary')::boolean, false),
        level = NULLIF(v_program->>'level', ''),
        goal = NULLIF(v_program->>'goal', ''),
        billing_type = v_program->>'billing_type',
        amount = NULLIF(v_program->>'amount', '')::numeric,
        due_day = NULLIF(v_program->>'due_day', '')::smallint,
        package_lessons = NULLIF(v_program->>'package_lessons', '')::smallint,
        auto_billing = COALESCE((v_program->>'auto_billing')::boolean, false),
        active = COALESCE((v_program->>'active')::boolean, true)
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
  IF jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um aluno.';
  END IF;

  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      teacher_id, student_id, starts_at, duration_minutes, lesson_type,
      status, location, notes
    ) VALUES (
      auth.uid(), (p_participants->0->>'student_id')::uuid,
      (p_lesson->>'starts_at')::timestamptz,
      (p_lesson->>'duration_minutes')::smallint,
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
      location = NULLIF(p_lesson->>'location', ''),
      notes = NULLIF(p_lesson->>'notes', '')
    WHERE id = v_lesson_id AND teacher_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Aula não encontrada.'; END IF;
  END IF;

  FOR v_participant IN SELECT value FROM jsonb_array_elements(p_participants)
  LOOP
    INSERT INTO public.lesson_participants (
      teacher_id, lesson_id, student_id, student_program_id
    ) VALUES (
      auth.uid(), v_lesson_id, (v_participant->>'student_id')::uuid,
      NULLIF(v_participant->>'student_program_id', '')::uuid
    )
    ON CONFLICT (lesson_id, student_id) DO UPDATE SET
      student_program_id = EXCLUDED.student_program_id;
  END LOOP;

  DELETE FROM public.lesson_participants lp
  WHERE lp.lesson_id = v_lesson_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_participants) item
      WHERE (item->>'student_id')::uuid = lp.student_id
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
BEGIN
  SELECT id INTO v_report_id FROM public.lesson_reports
  WHERE lesson_id = p_lesson_id AND scope = 'geral';

  IF v_report_id IS NULL THEN
    INSERT INTO public.lesson_reports (
      teacher_id, lesson_id, student_id, scope, content, exercises, notes
    ) VALUES (
      auth.uid(), p_lesson_id, NULL, 'geral',
      NULLIF(p_general->>'content', ''), NULLIF(p_general->>'exercises', ''),
      NULLIF(p_general->>'notes', '')
    );
  ELSE
    UPDATE public.lesson_reports SET
      content = NULLIF(p_general->>'content', ''),
      exercises = NULLIF(p_general->>'exercises', ''),
      notes = NULLIF(p_general->>'notes', '')
    WHERE id = v_report_id AND teacher_id = auth.uid();
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_individuals)
  LOOP
    v_report_id := NULL;
    SELECT id INTO v_report_id FROM public.lesson_reports
    WHERE lesson_id = p_lesson_id
      AND student_id = (v_item->>'student_id')::uuid
      AND scope = 'individual';

    IF v_report_id IS NULL THEN
      INSERT INTO public.lesson_reports (
        teacher_id, lesson_id, student_id, scope, content, exercises, notes
      ) VALUES (
        auth.uid(), p_lesson_id, (v_item->>'student_id')::uuid, 'individual',
        NULLIF(v_item->>'content', ''), NULLIF(v_item->>'exercises', ''),
        NULLIF(v_item->>'notes', '')
      );
    ELSE
      UPDATE public.lesson_reports SET
        content = NULLIF(v_item->>'content', ''),
        exercises = NULLIF(v_item->>'exercises', ''),
        notes = NULLIF(v_item->>'notes', '')
      WHERE id = v_report_id AND teacher_id = auth.uid();
    END IF;

    UPDATE public.lesson_participants SET
      attendance = COALESCE(NULLIF(v_item->>'attendance', ''), 'presente')
    WHERE lesson_id = p_lesson_id
      AND student_id = (v_item->>'student_id')::uuid
      AND teacher_id = auth.uid();
  END LOOP;

  UPDATE public.lessons SET status = 'realizada'
  WHERE id = p_lesson_id AND teacher_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Aula não encontrada.'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_student_with_programs(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lesson_with_participants(UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lesson_assessments(UUID, JSONB, JSONB) TO authenticated;
