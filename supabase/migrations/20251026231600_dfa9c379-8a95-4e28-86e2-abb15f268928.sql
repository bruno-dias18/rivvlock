-- Fix security issue: Remove public access to quotes via token
-- Access via secure_token will continue to work through the get-quote-by-token edge function
-- which uses service_role and proper validation

-- Remove the policy that allows public access via token
DROP POLICY IF EXISTS "quotes_select_by_token" ON public.quotes;

-- The following policies remain unchanged and ensure proper access control:
-- 1. quotes_select_seller_client_or_open: Sellers and clients can see their quotes
-- 2. quotes_insert_seller: Sellers can create quotes
-- 3. quotes_update_seller_or_system: Sellers and system can update quotes
-- 4. quotes_attach_to_client: Clients can attach themselves to quotes
-- 5. quotes_all_service_role: Service role has full access (for edge functions)