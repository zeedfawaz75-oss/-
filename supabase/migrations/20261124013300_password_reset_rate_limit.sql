CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_attempts_phone_created_idx
  ON public.password_reset_attempts (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_attempts_created_idx
  ON public.password_reset_attempts (created_at);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.consume_password_reset_attempt(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  IF p_phone IS NULL OR length(p_phone) < 8 OR length(p_phone) > 15 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(52741, hashtext(p_phone));

  DELETE FROM public.password_reset_attempts
  WHERE created_at < now() - interval '30 days';

  SELECT count(*) INTO recent_attempts
  FROM public.password_reset_attempts
  WHERE phone = p_phone
    AND created_at >= now() - interval '15 minutes';

  IF recent_attempts >= 5 THEN
    RETURN false;
  END IF;

  INSERT INTO public.password_reset_attempts (phone) VALUES (p_phone);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_password_reset_attempt(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_reset_attempt(TEXT) TO service_role;
