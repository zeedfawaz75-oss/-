CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = on) AS
  SELECT r.id, r.shop_id, r.rating, r.comment, r.author_name, r.created_at, r.updated_at
  FROM public.ratings r;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

REVOKE ALL ON public.ratings FROM anon;
GRANT SELECT (id, shop_id, rating, comment, author_name, created_at, updated_at) ON public.ratings TO anon;

DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
CREATE POLICY "Public can read review content"
  ON public.ratings FOR SELECT TO anon USING (true);