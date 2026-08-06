-- Compromissos pessoais, validação da agenda e infraestrutura de Web Push.
UPDATE public.blocked_dates SET end_date = start_date WHERE end_date < start_date;
ALTER TABLE public.blocked_dates
  ADD CONSTRAINT blocked_dates_range_check CHECK (end_date >= start_date);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  end_date DATE,
  blocks_lessons BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  reminder_minutes SMALLINT CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (
    (NOT all_day AND start_date IS NULL AND end_date IS NULL)
    OR (all_day AND start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  )
);

CREATE INDEX calendar_events_teacher_start_idx
  ON public.calendar_events(teacher_id, starts_at);
CREATE INDEX calendar_events_active_blocking_idx
  ON public.calendar_events(teacher_id, starts_at, ends_at)
  WHERE status = 'ativo' AND blocks_lessons;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar events" ON public.calendar_events FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER calendar_events_updated BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_lesson_overlap() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.teacher_id::text));
  IF EXISTS (
    SELECT 1 FROM public.lessons lesson
    WHERE lesson.teacher_id = NEW.teacher_id
      AND lesson.id <> NEW.id
      AND lesson.status <> 'cancelada'
      AND tstzrange(
        lesson.starts_at,
        lesson.starts_at + make_interval(mins => lesson.duration_minutes),
        '[)'
      ) && tstzrange(
        NEW.starts_at,
        NEW.starts_at + make_interval(mins => NEW.duration_minutes),
        '[)'
      )
  ) THEN
    RAISE EXCEPTION 'Conflito de horário: já existe uma aula nesse intervalo.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_lesson_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_local_date DATE;
  v_ends_at TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'cancelada'
     AND NEW.teacher_id = OLD.teacher_id
     AND NEW.starts_at = OLD.starts_at
     AND NEW.duration_minutes = OLD.duration_minutes THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.teacher_id::text));

  SELECT COALESCE(profile.timezone, 'America/Sao_Paulo') INTO v_timezone
  FROM public.profiles profile WHERE profile.id = NEW.teacher_id;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');
  v_local_date := (NEW.starts_at AT TIME ZONE v_timezone)::date;
  v_ends_at := NEW.starts_at + make_interval(mins => NEW.duration_minutes);

  IF EXISTS (
    SELECT 1 FROM public.blocked_dates blocked
    WHERE blocked.teacher_id = NEW.teacher_id
      AND v_local_date BETWEEN blocked.start_date AND blocked.end_date
  ) THEN
    RAISE EXCEPTION 'Data bloqueada na agenda.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.calendar_events event
    WHERE event.teacher_id = NEW.teacher_id
      AND event.status = 'ativo'
      AND event.blocks_lessons
      AND tstzrange(event.starts_at, event.ends_at, '[)')
        && tstzrange(NEW.starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflito com compromisso da agenda.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lessons_validate_schedule
BEFORE INSERT OR UPDATE OF teacher_id, starts_at, duration_minutes, status ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_schedule();

CREATE OR REPLACE FUNCTION public.validate_calendar_event_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  SELECT COALESCE(profile.timezone, 'America/Sao_Paulo') INTO v_timezone
  FROM public.profiles profile WHERE profile.id = NEW.teacher_id;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');

  IF NEW.all_day THEN
    NEW.starts_at := NEW.start_date::timestamp AT TIME ZONE v_timezone;
    NEW.ends_at := (NEW.end_date + 1)::timestamp AT TIME ZONE v_timezone;
  END IF;
  IF NEW.status = 'cancelado' OR NOT NEW.blocks_lessons THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.teacher_id::text));

  v_start_date := (NEW.starts_at AT TIME ZONE v_timezone)::date;
  v_end_date := ((NEW.ends_at - interval '1 microsecond') AT TIME ZONE v_timezone)::date;

  IF EXISTS (
    SELECT 1 FROM public.blocked_dates blocked
    WHERE blocked.teacher_id = NEW.teacher_id
      AND blocked.start_date <= v_end_date
      AND blocked.end_date >= v_start_date
  ) THEN
    RAISE EXCEPTION 'Conflito com data bloqueada na agenda.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lessons lesson
    WHERE lesson.teacher_id = NEW.teacher_id
      AND lesson.status <> 'cancelada'
      AND tstzrange(
        lesson.starts_at,
        lesson.starts_at + make_interval(mins => lesson.duration_minutes),
        '[)'
      ) && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflito com aula existente.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.calendar_events event
    WHERE event.teacher_id = NEW.teacher_id
      AND event.id <> NEW.id
      AND event.status = 'ativo'
      AND event.blocks_lessons
      AND tstzrange(event.starts_at, event.ends_at, '[)')
        && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflito com outro compromisso.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER calendar_events_validate_schedule
BEFORE INSERT OR UPDATE OF teacher_id, starts_at, ends_at, all_day, start_date, end_date, blocks_lessons, status
ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.validate_calendar_event_schedule();

UPDATE public.profiles profile
SET timezone = 'America/Sao_Paulo'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_timezone_names timezone_name WHERE timezone_name.name = profile.timezone
);

CREATE OR REPLACE FUNCTION public.validate_profile_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_timezone_names timezone_name WHERE timezone_name.name = NEW.timezone
  ) THEN
    RAISE EXCEPTION 'Fuso horário inválido.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_validate_timezone
BEFORE INSERT OR UPDATE OF timezone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_timezone();

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER push_subscriptions_updated BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_push_subscription(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  lesson_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (lesson_minutes BETWEEN 0 AND 10080),
  event_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (event_minutes BETWEEN 0 AND 10080),
  payment_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification preferences" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notification_preferences_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('lesson', 'calendar_event', 'payment')),
  resource_id UUID NOT NULL,
  reminder_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, resource_type, resource_id, reminder_at)
);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification deliveries" ON public.notification_deliveries FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_notification_delivery(
  p_user_id UUID,
  p_subscription_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_reminder_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notification_deliveries (
    user_id, subscription_id, resource_type, resource_id, reminder_at, status
  ) VALUES (
    p_user_id, p_subscription_id, p_resource_type, p_resource_id, p_reminder_at, 'processing'
  )
  ON CONFLICT (subscription_id, resource_type, resource_id, reminder_at) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    UPDATE public.notification_deliveries
    SET status = 'processing', claimed_at = now(), error = NULL
    WHERE subscription_id = p_subscription_id
      AND resource_type = p_resource_type
      AND resource_id = p_resource_id
      AND reminder_at = p_reminder_at
      AND (
        status = 'failed'
        OR (status = 'processing' AND claimed_at < now() - interval '5 minutes')
      )
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_notification_delivery(UUID, UUID, TEXT, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery(UUID, UUID, TEXT, UUID, TIMESTAMPTZ)
  TO service_role;
