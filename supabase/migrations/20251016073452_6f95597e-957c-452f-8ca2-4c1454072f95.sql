-- Add client_user_id column to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_client_user_id ON quotes(client_user_id);

-- Add comment for documentation
COMMENT ON COLUMN quotes.client_user_id IS 'ID de l''utilisateur client authentifié qui a rattaché ce devis à son compte';

-- Update RLS policies
-- Drop old policies
DROP POLICY IF EXISTS "quotes_select_seller" ON quotes;
DROP POLICY IF EXISTS "quotes_update_seller" ON quotes;

-- Allow seller OR attached client to read
CREATE POLICY "quotes_select_seller_or_client" ON quotes
FOR SELECT USING (
  seller_id = auth.uid() 
  OR client_user_id = auth.uid()
);

-- Only seller can update quote content
CREATE POLICY "quotes_update_seller_only" ON quotes
FOR UPDATE USING (
  seller_id = auth.uid()
)
WITH CHECK (
  seller_id = auth.uid()
);

-- Allow client to attach quote to their account (only if not already attached)
CREATE POLICY "quotes_attach_to_client" ON quotes
FOR UPDATE USING (
  auth.uid() IS NOT NULL 
  AND client_user_id IS NULL
)
WITH CHECK (
  client_user_id = auth.uid()
);