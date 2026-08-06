-- Condição financeira escolhida para cada aluno dentro de uma aula.
ALTER TABLE public.lesson_participants
  ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'recorrente'
    CHECK (billing_mode IN ('recorrente', 'avulsa', 'pacote', 'cortesia')),
  ADD COLUMN billing_amount NUMERIC(12,2)
    CHECK (billing_amount IS NULL OR billing_amount >= 0),
  ADD COLUMN payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('pix', 'dinheiro', 'cartao', 'transferencia'));

ALTER TABLE public.financial_transactions
  ADD COLUMN lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'mensalidade_automatica', 'aula_avulsa', 'pacote'));

CREATE INDEX financial_transactions_lesson_idx
  ON public.financial_transactions(lesson_id);

DROP POLICY "own financial transactions" ON public.financial_transactions;
CREATE POLICY "own financial transactions" ON public.financial_transactions FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      student_id IS NULL OR EXISTS (
        SELECT 1 FROM public.students student
        WHERE student.id = student_id AND student.teacher_id = auth.uid()
      )
    )
    AND (
      student_program_id IS NULL OR EXISTS (
        SELECT 1 FROM public.student_programs program
        WHERE program.id = student_program_id
          AND (financial_transactions.student_id IS NULL OR program.student_id = financial_transactions.student_id)
          AND program.teacher_id = auth.uid()
      )
    )
    AND (
      lesson_id IS NULL OR EXISTS (
        SELECT 1 FROM public.lessons lesson
        WHERE lesson.id = lesson_id AND lesson.teacher_id = auth.uid()
      )
    )
  );

UPDATE public.lesson_participants participant
SET
  billing_mode = CASE program.billing_type
    WHEN 'aula_avulsa' THEN 'avulsa'
    WHEN 'pacote' THEN 'pacote'
    ELSE 'recorrente'
  END,
  billing_amount = program.amount,
  payment_method = CASE WHEN program.billing_type = 'aula_avulsa' THEN 'pix' ELSE NULL END
FROM public.student_programs program
WHERE program.id = participant.student_program_id;

UPDATE public.financial_transactions
SET origin = CASE
  WHEN source_key LIKE 'mensalidade:%' THEN 'mensalidade_automatica'
  WHEN source_key LIKE 'aula:%' THEN 'aula_avulsa'
  ELSE 'manual'
END;

CREATE OR REPLACE FUNCTION public.set_financial_transaction_origin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source_key LIKE 'mensalidade:%' THEN
    NEW.origin := 'mensalidade_automatica';
  ELSIF NEW.source_key LIKE 'aula:%' THEN
    NEW.origin := 'aula_avulsa';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_transactions_origin
BEFORE INSERT OR UPDATE OF source_key ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_financial_transaction_origin();

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
  v_student_name TEXT;
  v_starts_at TIMESTAMPTZ;
  v_timezone TEXT;
  v_lesson_date DATE;
  v_lesson_status public.lesson_status;
  v_billing_mode TEXT;
  v_billing_amount NUMERIC(12,2);
  v_payment_method TEXT;
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
    WHERE jsonb_typeof(item) <> 'object'
      OR NULLIF(item->>'student_id', '') IS NULL
      OR COALESCE(item->>'billing_mode', '') NOT IN ('recorrente', 'avulsa', 'pacote', 'cortesia')
      OR (
        item->>'billing_mode' = 'avulsa'
        AND COALESCE(NULLIF(item->>'billing_amount', '')::numeric, 0) <= 0
      )
  ) THEN
    RAISE EXCEPTION 'Participante ou condição financeira inválida.';
  END IF;

  v_starts_at := (p_lesson->>'starts_at')::timestamptz;
  v_lesson_status := COALESCE(NULLIF(p_lesson->>'status', ''), 'agendada')::public.lesson_status;
  SELECT COALESCE(profile.timezone, 'America/Sao_Paulo') INTO v_timezone
  FROM public.profiles profile WHERE profile.id = auth.uid();
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');
  v_lesson_date := (v_starts_at AT TIME ZONE v_timezone)::date;

  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      teacher_id, student_id, starts_at, duration_minutes, lesson_type, status, location, notes
    ) VALUES (
      auth.uid(), (p_participants->0->>'student_id')::uuid, v_starts_at,
      (p_lesson->>'duration_minutes')::smallint,
      (p_lesson->>'lesson_type')::public.lesson_type,
      COALESCE(NULLIF(p_lesson->>'status', ''), 'agendada')::public.lesson_status,
      NULLIF(p_lesson->>'location', ''), NULLIF(p_lesson->>'notes', '')
    ) RETURNING id INTO v_lesson_id;
  ELSE
    UPDATE public.lessons SET
      student_id = (p_participants->0->>'student_id')::uuid,
      starts_at = v_starts_at,
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
    v_billing_mode := v_participant->>'billing_mode';
    v_billing_amount := NULLIF(v_participant->>'billing_amount', '')::numeric;
    v_payment_method := NULLIF(v_participant->>'payment_method', '');

    INSERT INTO public.lesson_participants (
      teacher_id, lesson_id, student_id, student_program_id,
      billing_mode, billing_amount, payment_method
    ) VALUES (
      auth.uid(), v_lesson_id, (v_participant->>'student_id')::uuid,
      NULLIF(v_participant->>'student_program_id', '')::uuid,
      v_billing_mode, v_billing_amount, v_payment_method
    )
    ON CONFLICT (lesson_id, student_id) DO UPDATE SET
      student_program_id = EXCLUDED.student_program_id,
      billing_mode = EXCLUDED.billing_mode,
      billing_amount = EXCLUDED.billing_amount,
      payment_method = EXCLUDED.payment_method;

    IF v_billing_mode = 'avulsa' AND v_lesson_status <> 'cancelada' THEN
      SELECT name INTO v_student_name FROM public.students
      WHERE id = (v_participant->>'student_id')::uuid AND teacher_id = auth.uid();

      INSERT INTO public.financial_transactions (
        teacher_id, student_id, student_program_id, lesson_id, student_name,
        description, amount, type, category, status, payment_method,
        competence_date, due_date, source_key, origin
      ) VALUES (
        auth.uid(), (v_participant->>'student_id')::uuid,
        NULLIF(v_participant->>'student_program_id', '')::uuid,
        v_lesson_id, v_student_name, 'Aula avulsa', v_billing_amount,
        'receita', 'aula_avulsa', 'pendente', COALESCE(v_payment_method, 'pix'),
        date_trunc('month', v_lesson_date)::date, v_lesson_date,
        'aula:' || v_lesson_id::text || ':' || (v_participant->>'student_id'),
        'aula_avulsa'
      )
      ON CONFLICT (teacher_id, source_key) DO UPDATE SET
        student_program_id = EXCLUDED.student_program_id,
        lesson_id = EXCLUDED.lesson_id,
        amount = EXCLUDED.amount,
        payment_method = EXCLUDED.payment_method,
        competence_date = EXCLUDED.competence_date,
        due_date = EXCLUDED.due_date
      WHERE public.financial_transactions.status <> 'pago';
    END IF;
  END LOOP;

  DELETE FROM public.lesson_participants participant
  WHERE participant.lesson_id = v_lesson_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_participants) item
      WHERE (item->>'student_id')::uuid = participant.student_id
    );

  DELETE FROM public.financial_transactions financial_row
  WHERE financial_row.lesson_id = v_lesson_id
    AND financial_row.origin = 'aula_avulsa'
    AND financial_row.status <> 'pago'
    AND (
      v_lesson_status = 'cancelada'
      OR NOT EXISTS (
        SELECT 1 FROM public.lesson_participants participant
        WHERE participant.lesson_id = v_lesson_id
          AND participant.student_id = financial_row.student_id
          AND participant.billing_mode = 'avulsa'
      )
    );

  RETURN v_lesson_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_pending_lesson_charges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_transactions
  WHERE lesson_id = OLD.id AND origin = 'aula_avulsa' AND status <> 'pago';
  RETURN OLD;
END;
$$;

CREATE TRIGGER lessons_cleanup_pending_charges
BEFORE DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.cleanup_pending_lesson_charges();

REVOKE EXECUTE ON FUNCTION public.save_lesson_with_participants(UUID, JSONB, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lesson_with_participants(UUID, JSONB, JSONB)
  TO authenticated;
