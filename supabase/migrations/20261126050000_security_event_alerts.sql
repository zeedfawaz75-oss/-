CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'auth_missing_credentials',
      'auth_invalid_credentials',
      'auth_missing_subject',
      'admin_role_denied',
      'client_login_failure_reported'
    )
  ),
  source TEXT NOT NULL CHECK (source IN ('server', 'client_reported_unverified')),
  source_hash TEXT CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX security_events_type_source_created_idx
  ON public.security_events (event_type, source, source_hash, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.security_event_ingest_limits (
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  window_start TIMESTAMPTZ NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_type, source, source_hash, window_start)
);

CREATE INDEX security_event_ingest_limits_window_idx
  ON public.security_event_ingest_limits (window_start);

ALTER TABLE public.security_event_ingest_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_event_ingest_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_security_event(
  p_event_type TEXT,
  p_source TEXT,
  p_actor_user_id UUID,
  p_source_hash TEXT
)
RETURNS TABLE (event_id UUID, recent_count BIGINT, recorded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_recent_count BIGINT;
  v_window_start TIMESTAMPTZ := date_trunc('minute', now());
  v_ingest_count INTEGER;
BEGIN
  IF p_event_type NOT IN (
    'auth_missing_credentials',
    'auth_invalid_credentials',
    'auth_missing_subject',
    'admin_role_denied',
    'client_login_failure_reported'
  ) THEN
    RAISE EXCEPTION 'Invalid security event type';
  END IF;

  IF p_source NOT IN ('server', 'client_reported_unverified') THEN
    RAISE EXCEPTION 'Invalid security event source';
  END IF;

  IF p_source_hash IS NOT NULL AND p_source_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid security event source hash';
  END IF;

  IF p_source_hash IS NOT NULL THEN
    INSERT INTO public.security_event_ingest_limits (
      event_type, source, source_hash, window_start, event_count
    )
    VALUES (p_event_type, p_source, p_source_hash, v_window_start, 1)
    ON CONFLICT (event_type, source, source_hash, window_start)
    DO UPDATE SET event_count = public.security_event_ingest_limits.event_count + 1
    RETURNING public.security_event_ingest_limits.event_count INTO v_ingest_count;

    DELETE FROM public.security_event_ingest_limits
    WHERE window_start < now() - interval '24 hours';

    IF v_ingest_count > 20 THEN
      RETURN QUERY SELECT NULL::UUID, v_ingest_count::BIGINT, FALSE;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.security_events (event_type, source, source_hash, actor_user_id)
  VALUES (p_event_type, p_source, p_source_hash, p_actor_user_id)
  RETURNING id INTO v_event_id;

  SELECT count(*) INTO v_recent_count
  FROM public.security_events
  WHERE event_type = p_event_type
    AND source = p_source
    AND source_hash IS NOT DISTINCT FROM p_source_hash
    AND created_at >= now() - interval '10 minutes';

  RETURN QUERY SELECT v_event_id, v_recent_count, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_security_event(TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_event(TEXT, TEXT, UUID, TEXT)
  TO service_role;

-- Retain historical auth-attempt records, but make them inaccessible to public roles.
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_attempts FROM PUBLIC, anon, authenticated, service_role;
