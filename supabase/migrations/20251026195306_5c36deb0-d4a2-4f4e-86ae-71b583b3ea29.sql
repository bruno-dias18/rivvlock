-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false);

-- RLS Policies for kyc-documents bucket
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can delete KYC documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Users can update their own KYC documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);