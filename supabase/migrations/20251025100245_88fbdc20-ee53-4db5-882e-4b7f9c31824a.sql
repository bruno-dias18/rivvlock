-- Add company_logo_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_logo_url text;

-- Add index for performance (only for non-null values)
CREATE INDEX IF NOT EXISTS idx_profiles_company_logo 
ON public.profiles(company_logo_url) 
WHERE company_logo_url IS NOT NULL;

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos', 
  'company-logos', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own logo
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can update their own logo
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can delete their own logo
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Public read access for logos (needed for PDF generation)
CREATE POLICY "Public read access for company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');