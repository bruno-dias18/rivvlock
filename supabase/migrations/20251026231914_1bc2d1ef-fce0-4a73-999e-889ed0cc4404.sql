-- Fix 2 security issues without regressions

-- PROBLEM 1: Remove overly permissive quote access
-- Old policy allowed ANY authenticated user to see unassigned quotes
-- This exposed business data to competitors who create accounts
DROP POLICY IF EXISTS "quotes_select_seller_client_or_open" ON public.quotes;

-- Create restrictive replacement: only seller, assigned client, or admin can view
CREATE POLICY "quotes_select_participants_only" ON public.quotes
FOR SELECT
USING (
  (seller_id = auth.uid()) 
  OR (client_user_id = auth.uid() AND client_user_id IS NOT NULL)
  OR is_admin(auth.uid())
);

-- PROBLEM 2: Feature flags should not be public
-- Old policy allowed anyone (even unauthenticated) to see roadmap
DROP POLICY IF EXISTS "Anyone can view feature flags" ON public.feature_flags;

-- Create restrictive replacement: only authenticated users can view
CREATE POLICY "Authenticated users can view feature flags" ON public.feature_flags
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- All other policies remain unchanged:
-- - quotes_insert_seller: Sellers can create quotes ✓
-- - quotes_update_seller_or_system: Sellers and system can update ✓
-- - quotes_attach_to_client: Clients can attach themselves ✓
-- - quotes_all_service_role: Service role has full access ✓
-- - get-quote-by-token edge function continues to work via service_role ✓
-- - Only admins can manage feature flags ✓