
CREATE OR REPLACE FUNCTION public.prevent_owner_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this; only block when called as a regular user
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_prevent_owner_status_change ON public.shops;
CREATE TRIGGER shops_prevent_owner_status_change
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_status_change();
