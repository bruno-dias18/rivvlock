-- CRITICAL FIX: Block public/anonymous access to audit tables
-- This addresses the newly created security warnings

-- ============================================
-- 1. STRIPE ACCOUNT ACCESS AUDIT: Block anon
-- ============================================

-- Drop all existing policies and recreate with strict access control
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Only admins can view stripe access audit" ON public.stripe_account_access_audit;
  DROP POLICY IF EXISTS "System can insert stripe access audit" ON public.stripe_account_access_audit;
  DROP POLICY IF EXISTS "Block public access" ON public.stripe_account_access_audit;
  DROP POLICY IF EXISTS "Block anonymous access" ON public.stripe_account_access_audit;
END $$;

-- Explicitly block ALL anonymous access first
CREATE POLICY "Block anonymous access to stripe audit"
ON public.stripe_account_access_audit
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Explicitly block ALL public SELECT
CREATE POLICY "Block public SELECT on stripe audit"
ON public.stripe_account_access_audit
FOR SELECT
USING (false);

-- Only authenticated admins can view audit logs
CREATE POLICY "Only admins can view stripe access audit"
ON public.stripe_account_access_audit
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Authenticated system can insert audit logs
CREATE POLICY "Authenticated can insert stripe access audit"
ON public.stripe_account_access_audit
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- 2. USER_ROLES: Block anon access
-- ============================================

-- Drop and recreate policies for user_roles
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Only super admins can manage user roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Block anonymous access to user roles" ON public.user_roles;
END $$;

-- Explicitly block ALL anonymous access
CREATE POLICY "Block anonymous access to user roles"
ON public.user_roles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Only authenticated super admins can manage roles
CREATE POLICY "Only super admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Authenticated users can read their own roles only
CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'super_admin'::app_role));