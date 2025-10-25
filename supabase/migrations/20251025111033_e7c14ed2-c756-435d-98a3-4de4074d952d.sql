-- Créer le bucket pour les logos d'entreprise
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy : Les utilisateurs peuvent uploader leur propre logo
CREATE POLICY "Users can upload their own company logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy : Les utilisateurs peuvent mettre à jour leur propre logo
CREATE POLICY "Users can update their own company logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy : Les utilisateurs peuvent supprimer leur propre logo
CREATE POLICY "Users can delete their own company logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy : Les logos sont publiquement visibles (pour les factures PDF)
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');