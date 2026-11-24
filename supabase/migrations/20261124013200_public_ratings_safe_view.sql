-- Expose only review fields intended for public display; keep ratings.user_id private.
DROP POLICY IF EXISTS "Ratings are public read" ON public.ratings;
DROP POLICY IF EXISTS "Ratings readable via public view" ON public.ratings;
DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.ratings;
DROP POLICY IF EXISTS "Users can read their own rating rows" ON public.ratings;

CREATE POLICY "Users can read their own rating rows"
  ON public.ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.ratings FROM anon;
REVOKE SELECT (id, user_id, shop_id, rating, comment, author_name, created_at, updated_at)
  ON public.ratings FROM anon;

CREATE OR REPLACE VIEW public.public_ratings
WITH (security_barrier = true, security_invoker = false) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;

GRANT SELECT ON public.public_ratings TO anon, authenticated;
