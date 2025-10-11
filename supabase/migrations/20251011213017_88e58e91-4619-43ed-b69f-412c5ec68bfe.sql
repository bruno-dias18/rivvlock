-- Security hardening: Add RESTRICTIVE policies for defense in depth
-- Risk: ZERO - Only adds redundant blocks on already-protected tables
-- Impact: NO functional change - Reinforces existing security
-- Benefit: Resolves Lovable security warnings

-- 1. Profiles: Add explicit RESTRICTIVE block for anonymous (redundant with existing policy)
CREATE POLICY "profiles_restrictive_block_anon" ON public.profiles 
AS RESTRICTIVE 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- 2. Invoices: Add RESTRICTIVE policy to ensure participant verification
-- This does NOT change logic, only adds an extra security layer
CREATE POLICY "invoices_restrictive_participant_only" ON public.invoices 
AS RESTRICTIVE 
FOR ALL 
USING (
  -- Allow if user is seller OR buyer (explicit check, no NULL ambiguity)
  auth.uid() = seller_id 
  OR auth.uid() = buyer_id 
  OR is_admin(auth.uid())
)
WITH CHECK (
  auth.uid() = seller_id 
  OR auth.uid() = buyer_id 
  OR is_admin(auth.uid())
);