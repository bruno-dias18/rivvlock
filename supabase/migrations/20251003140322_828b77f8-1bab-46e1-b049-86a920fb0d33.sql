-- Harden RLS for sensitive security/audit tables
-- 1) Ensure RLS is enabled and enforced
ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- 2) Admin audit log: restrict SELECT explicitly to authenticated super admins
DROP POLICY IF EXISTS "Super admins can read audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Super admins can read audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Keep block anonymous policy; ensure INSERT is also scoped to authenticated super admins
DROP POLICY IF EXISTS "Super admins can manage audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Super admins can manage audit logs"
ON public.admin_role_audit_log
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- 3) Shared link access logs: restrict SELECT explicitly to authenticated admins
DROP POLICY IF EXISTS "Admin only SELECT access logs" ON public.shared_link_access_logs;
CREATE POLICY "Admins can select access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- Note: existing "Secure authenticated insert only" policy already limits INSERT to authenticated users