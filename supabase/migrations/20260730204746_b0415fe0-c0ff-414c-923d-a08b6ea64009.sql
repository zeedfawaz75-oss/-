-- 1. Bank details in a protected table
CREATE TABLE IF NOT EXISTS public.shop_bank_details (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  bank_name TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.shop_bank_details (shop_id, bank_name, bank_account_holder, bank_account_number)
SELECT id, bank_name, bank_account_holder, bank_account_number
FROM public.shops
WHERE bank_name IS NOT NULL OR bank_account_holder IS NOT NULL OR bank_account_number IS NOT NULL
ON CONFLICT (shop_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_bank_details TO authenticated;
GRANT ALL ON public.shop_bank_details TO service_role;
ALTER TABLE public.shop_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own bank details" ON public.shop_bank_details
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners insert own bank details" ON public.shop_bank_details
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners update own bank details" ON public.shop_bank_details
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners delete own bank details" ON public.shop_bank_details
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Admins manage bank details" ON public.shop_bank_details
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.shops
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_holder,
  DROP COLUMN IF EXISTS bank_account_number;

-- 2. Ratings: hide user_id from public reads
DROP POLICY IF EXISTS "Ratings are public read" ON public.ratings;
CREATE POLICY "Users view own rating" ON public.ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE SELECT ON public.ratings FROM anon;

CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = off) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

-- 3. Lock down SECURITY DEFINER trigger/helper functions
REVOKE EXECUTE ON FUNCTION public.recompute_shop_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_shop() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_shop_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;