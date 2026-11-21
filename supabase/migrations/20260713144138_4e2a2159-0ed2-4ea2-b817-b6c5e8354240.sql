
-- Public read on shops-images
DROP POLICY IF EXISTS "Public read shops-images" ON storage.objects;
CREATE POLICY "Public read shops-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'shops-images');

-- Authenticated users can upload into folder = auth.uid()
DROP POLICY IF EXISTS "Users upload own shops-images" ON storage.objects;
CREATE POLICY "Users upload own shops-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shops-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update/delete their own files; admins can do any
DROP POLICY IF EXISTS "Owners update own shops-images" ON storage.objects;
CREATE POLICY "Owners update own shops-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shops-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Owners delete own shops-images" ON storage.objects;
CREATE POLICY "Owners delete own shops-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shops-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'))
  );
