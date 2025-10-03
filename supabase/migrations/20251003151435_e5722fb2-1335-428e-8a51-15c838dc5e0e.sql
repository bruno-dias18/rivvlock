-- Hardening sensitive log tables to eliminate critical security warnings
-- This removes public/anon/authenticated access at the PostgreSQL privilege level
-- RLS policies remain active but become the ONLY access mechanism

-- ============================================================================
-- 1. ADMIN_ROLE_AUDIT_LOG - Fix "Admin Activity Records Could Be Stolen"
-- ============================================================================

-- Revoke all privileges from public roles
REVOKE ALL ON public.admin_role_audit_log FROM public, anon, authenticated;

-- Grant only to service_role (for super admin functions)
GRANT SELECT, INSERT ON public.admin_role_audit_log TO service_role;

-- Clean up redundant RLS policies (keep only the essential ones)
DROP POLICY IF EXISTS "Admin only log access" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "Admins can view access logs (strict)" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "Admins view access logs strict" ON public.admin_role_audit_log;

-- Keep the most restrictive policies
-- The existing "Only super admins can view audit logs" and "Only super admins can insert audit logs" remain active


-- ============================================================================
-- 2. SHARED_LINK_ACCESS_LOGS - Fix "User Access Patterns Could Be Tracked"
-- ============================================================================

-- Revoke all privileges from public roles
REVOKE ALL ON public.shared_link_access_logs FROM public, anon, authenticated;

-- Grant only to service_role (for edge functions logging and admin access)
GRANT SELECT, INSERT ON public.shared_link_access_logs TO service_role;

-- Clean up redundant RLS policies
DROP POLICY IF EXISTS "Block public ALL on access logs v2" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block public SELECT on access logs v2" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block public access to logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block user modifications to access logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block anon SELECT on access logs" ON public.shared_link_access_logs;

-- Keep the essential policies:
-- "Admin only log access", "Service role can insert access logs", "Only admins can view access logs"


-- ============================================================================
-- 3. PROFILE_ACCESS_LOGS - Preventive hardening
-- ============================================================================

REVOKE ALL ON public.profile_access_logs FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.profile_access_logs TO service_role;


-- ============================================================================
-- 4. TRANSACTION_ACCESS_ATTEMPTS - Preventive hardening
-- ============================================================================

REVOKE ALL ON public.transaction_access_attempts FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.transaction_access_attempts TO service_role;


-- ============================================================================
-- 5. ACTIVITY_LOGS - Partial hardening (users need INSERT for their own logs)
-- ============================================================================

-- Revoke default public access
REVOKE ALL ON public.activity_logs FROM public, anon;

-- Grant minimal necessary privileges
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

-- Note: activity_logs needs authenticated INSERT because users log their own activities
-- RLS policies ensure users can only INSERT their own records