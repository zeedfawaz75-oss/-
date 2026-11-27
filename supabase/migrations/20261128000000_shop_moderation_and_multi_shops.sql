-- Allow the same account to submit multiple listings when their category or
-- activity differs. Exact duplicates for the same owner/category remain blocked.
DROP INDEX IF EXISTS public.shops_phone_unique;
DROP INDEX IF EXISTS public.shops_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS shops_owner_listing_unique
  ON public.shops (
    owner_id,
    sector_id,
    subsection_id,
    phone,
    lower(name)
  );

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_rejection_reason_length;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_rejection_reason_length
  CHECK (rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 3 AND 500);

CREATE TABLE IF NOT EXISTS public.shop_moderation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('deleted')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_moderation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shop_moderation_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shop_moderation_audit TO service_role;

DROP POLICY IF EXISTS "Admins view shop moderation audit"
  ON public.shop_moderation_audit;
CREATE POLICY "Admins view shop moderation audit"
  ON public.shop_moderation_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Confirm status changes against the authenticated admin role or service role.
CREATE OR REPLACE FUNCTION public.shops_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.has_role(auth.uid(), 'admin')
       OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Admins can update all shops" ON public.shops;
CREATE POLICY "Admins can update all shops"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Include the moderation reason in the owner's rejection notification.
CREATE OR REPLACE FUNCTION public.notify_owner_shop_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reason_text TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, body, shop_id)
      VALUES (
        NEW.owner_id,
        'shop_approved',
        'تم قبول محلك 🎉',
        'تم اعتماد محلك «' || NEW.name || '» بنجاح وأصبح ظاهرًا في الدليل.',
        NEW.id
      );
    ELSIF NEW.status = 'rejected' THEN
      reason_text := NULLIF(btrim(COALESCE(NEW.rejection_reason, '')), '');
      INSERT INTO public.notifications (user_id, type, title, body, shop_id)
      VALUES (
        NEW.owner_id,
        'shop_rejected',
        'تم رفض طلب محلك',
        'لم يتم اعتماد «' || NEW.name || '».' ||
          CASE WHEN reason_text IS NOT NULL THEN ' السبب: ' || reason_text ELSE '' END,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_notify_owner_after_status_update ON public.shops;
CREATE TRIGGER shops_notify_owner_after_status_update
AFTER UPDATE OF status, rejection_reason ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_shop_status();
