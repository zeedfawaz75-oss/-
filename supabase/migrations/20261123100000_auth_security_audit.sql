CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_phone_created_idx
  ON public.auth_attempts (phone, created_at DESC);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.auth_attempts TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_security_audit_created_idx
  ON public.admin_security_audit (created_at DESC);

ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_security_audit FROM PUBLIC, anon;
GRANT SELECT ON public.admin_security_audit TO authenticated;
GRANT ALL ON public.admin_security_audit TO service_role;

CREATE POLICY "Admins view security audit"
  ON public.admin_security_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Cleanup policy to remove old auth attempts
CREATE OR REPLACE FUNCTION public.cleanup_auth_attempts()
RETURNS VOID AS
$$
BEGIN
  DELETE FROM public.auth_attempts
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_admin_security_audit()
RETURNS VOID AS
$$
BEGIN
  DELETE FROM public.admin_security_audit
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;
