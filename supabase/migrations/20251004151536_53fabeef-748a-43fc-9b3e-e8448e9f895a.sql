-- Fix misconfigured RESTRICTIVE policies that cause security alerts
-- These policies should block ALL access with "false", not check auth status

-- ============================================
-- STRIPE_ACCOUNT_ACCESS_AUDIT: Fix broken RESTRICTIVE policy
-- ============================================

-- Remove the incorrectly configured RESTRICTIVE policy
DROP POLICY IF EXISTS "public_deny_select_stripe_audit" ON public.stripe_account_access_audit;

-- Replace with correct RESTRICTIVE policy that explicitly blocks SELECT
CREATE POLICY "block_all_public_select_stripe_audit"
ON public.stripe_account_access_audit
AS RESTRICTIVE
FOR SELECT
USING (false);

-- ============================================
-- USER_ROLES: Fix broken RESTRICTIVE policy
-- ============================================

-- Remove the incorrectly configured RESTRICTIVE policy
DROP POLICY IF EXISTS "public_deny_all_user_roles" ON public.user_roles;

-- Replace with correct RESTRICTIVE policy that explicitly blocks ALL
CREATE POLICY "block_all_public_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);

-- ============================================
-- Verify working PERMISSIVE policies remain active
-- ============================================

-- stripe_account_access_audit still has:
-- - admins_can_select_stripe_audit (PERMISSIVE SELECT for admins)
-- - authenticated_can_insert_stripe_audit (PERMISSIVE INSERT)
-- - anon_deny_all_stripe_audit (RESTRICTIVE ALL with false)
-- - public_deny_all_stripe_audit (RESTRICTIVE ALL with false)

-- user_roles still has:
-- - users_read_own_roles (PERMISSIVE SELECT for own roles + super admins)
-- - super_admins_manage_all_roles (PERMISSIVE ALL for super admins)
-- - anon_deny_all_user_roles (RESTRICTIVE ALL with false)
-- - public_deny_all_user_roles_explicit (RESTRICTIVE ALL with false)