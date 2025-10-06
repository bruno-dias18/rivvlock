-- FIX CRITICAL SECURITY: Block anonymous access to stripe_account_access_audit
DROP POLICY IF EXISTS "public_deny_all_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "block_all_public_select_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "anon_deny_all_stripe_audit" ON public.stripe_account_access_audit;

CREATE POLICY "block_anon_select_stripe_audit" 
ON public.stripe_account_access_audit 
FOR SELECT 
TO anon 
USING (false);

CREATE POLICY "block_anon_all_stripe_audit" 
ON public.stripe_account_access_audit 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

-- FIX CRITICAL SECURITY: Block anonymous access to user_roles
DROP POLICY IF EXISTS "public_deny_all_user_roles_explicit" ON public.user_roles;
DROP POLICY IF EXISTS "block_all_public_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "anon_deny_all_user_roles" ON public.user_roles;

CREATE POLICY "block_anon_select_user_roles" 
ON public.user_roles 
FOR SELECT 
TO anon 
USING (false);

CREATE POLICY "block_anon_all_user_roles" 
ON public.user_roles 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);