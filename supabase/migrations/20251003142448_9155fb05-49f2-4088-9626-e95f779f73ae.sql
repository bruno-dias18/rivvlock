-- Lock down admin_role_audit_log (super admin access only)
ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_audit_log FORCE ROW LEVEL SECURITY;

-- Block all anonymous access explicitly
DROP POLICY IF EXISTS "Block anonymous access to admin audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Block anonymous access to admin audit logs"
ON public.admin_role_audit_log
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Restrict SELECT to authenticated super admins only
DROP POLICY IF EXISTS "Super admins can read audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Super admins can read audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));