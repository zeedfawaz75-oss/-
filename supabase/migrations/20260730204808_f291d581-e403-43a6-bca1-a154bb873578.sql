CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = on) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

-- Column-level grant: anon can never read user_id
REVOKE SELECT ON public.ratings FROM anon;
GRANT SELECT (id, shop_id, rating, comment, author_name, created_at, updated_at)
  ON public.ratings TO anon;

CREATE POLICY "Ratings readable via public view" ON public.ratings
  FOR SELECT TO anon
  USING (true);