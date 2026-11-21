DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
REVOKE SELECT ON public.ratings FROM anon;
CREATE POLICY "Authenticated can read reviews" ON public.ratings FOR SELECT TO authenticated USING (true);