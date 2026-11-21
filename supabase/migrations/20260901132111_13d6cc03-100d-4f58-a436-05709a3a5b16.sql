DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.ratings;
CREATE POLICY "Users can read their own rating rows"
ON public.ratings FOR SELECT TO authenticated
USING (auth.uid() = user_id);