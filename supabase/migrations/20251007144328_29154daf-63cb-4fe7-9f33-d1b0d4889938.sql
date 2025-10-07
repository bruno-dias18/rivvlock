-- Fix security alerts by adding RESTRICTIVE policies
-- These force authentication on top of existing PERMISSIVE policies

-- Force authentication on stripe_account_access_audit
DROP POLICY IF EXISTS "force_auth_stripe_audit" ON public.stripe_account_access_audit;
CREATE POLICY "force_auth_stripe_audit"
  ON public.stripe_account_access_audit
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (auth.uid() IS NOT NULL);

-- Force authentication on user_roles  
DROP POLICY IF EXISTS "force_auth_user_roles" ON public.user_roles;
CREATE POLICY "force_auth_user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (auth.uid() IS NOT NULL);