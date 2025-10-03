-- Fix admin_role_audit_log RLS policies
-- Drop the problematic "Block anonymous access" policy and ensure proper access control

DROP POLICY IF EXISTS "Block anonymous access to admin audit logs" ON public.admin_role_audit_log;

-- Ensure only super admins can SELECT
CREATE POLICY "Only super admins can view audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Ensure only super admins can INSERT (already exists but let's be explicit)
DROP POLICY IF EXISTS "Super admins can manage audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Only super admins can insert audit logs"
ON public.admin_role_audit_log
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Block all other operations
CREATE POLICY "Block all other operations on audit logs"
ON public.admin_role_audit_log
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Fix shared_link_access_logs RLS policies
-- Remove overly permissive policies

DROP POLICY IF EXISTS "Block anonymous access to shared link logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Authenticated can insert shared link logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "System can insert access logs" ON public.shared_link_access_logs;

-- Only admins can SELECT
DROP POLICY IF EXISTS "Admins can select access logs" ON public.shared_link_access_logs;
CREATE POLICY "Only admins can view access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- Allow INSERT only from service role (backend edge functions)
CREATE POLICY "Service role can insert access logs"
ON public.shared_link_access_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Block all other operations for regular users
CREATE POLICY "Block user modifications to access logs"
ON public.shared_link_access_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);