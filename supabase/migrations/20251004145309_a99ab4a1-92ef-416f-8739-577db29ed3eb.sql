-- ULTRA STRICT FIX: Complete policy cleanup and rebuild
-- Ensuring NO public access to audit tables

-- ============================================
-- STRIPE ACCOUNT ACCESS AUDIT: Total rebuild
-- ============================================

-- First, drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'stripe_account_access_audit'
          AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stripe_account_access_audit', pol.policyname);
    END LOOP;
END $$;

-- Create ultra-restrictive default policy for anonymous users
CREATE POLICY "anon_deny_all_stripe_audit"
ON public.stripe_account_access_audit
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Block all public access by default
CREATE POLICY "public_deny_select_stripe_audit"
ON public.stripe_account_access_audit
AS RESTRICTIVE
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow only authenticated admins to SELECT
CREATE POLICY "admins_can_select_stripe_audit"
ON public.stripe_account_access_audit
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Allow authenticated users to INSERT audit logs
CREATE POLICY "authenticated_can_insert_stripe_audit"
ON public.stripe_account_access_audit
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- USER_ROLES: Total rebuild
-- ============================================

-- First, drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_roles'
          AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;

-- Create ultra-restrictive default policy for anonymous users
CREATE POLICY "anon_deny_all_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Block all public access by default
CREATE POLICY "public_deny_all_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to read their OWN roles only
CREATE POLICY "users_read_own_roles"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow only super admins to manage all roles
CREATE POLICY "super_admins_manage_all_roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));