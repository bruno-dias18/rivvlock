-- ============================================
-- MIGRATION: Quote Access - First Come First Served
-- Description: Allow any authenticated user to access open quotes (client_user_id IS NULL)
--              and automatically link them as client when they interact
-- ============================================

-- 1. Drop old restrictive policies
DROP POLICY IF EXISTS quotes_select_seller_or_client ON quotes;
DROP POLICY IF EXISTS quotes_update_seller_only ON quotes;

-- 2. New flexible SELECT policy (seller + client + open quotes for authenticated users)
CREATE POLICY quotes_select_seller_client_or_open ON quotes
FOR SELECT
USING (
  seller_id = auth.uid() 
  OR client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth.uid() IS NOT NULL)
);

-- 3. New flexible UPDATE policy (seller + service_role for auto-linking)
CREATE POLICY quotes_update_seller_or_system ON quotes
FOR UPDATE
USING (
  seller_id = auth.uid()
  OR (current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
)
WITH CHECK (
  seller_id = auth.uid()
  OR (current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
);

-- 4. Add index for performance optimization on open quotes
CREATE INDEX IF NOT EXISTS idx_quotes_open_client_null 
ON quotes (seller_id, created_at DESC) 
WHERE client_user_id IS NULL;

-- 5. Add index for faster client_user_id lookups
CREATE INDEX IF NOT EXISTS idx_quotes_client_user_id 
ON quotes (client_user_id) 
WHERE client_user_id IS NOT NULL;