-- Bloquer explicitement l'accès anonyme aux tables de logs d'audit

-- 1. Bloquer l'accès anonyme à admin_role_audit_log
CREATE POLICY "Block anonymous access to admin audit logs"
ON public.admin_role_audit_log
FOR ALL
TO anon
USING (false);

-- 2. Bloquer l'accès anonyme à shared_link_access_logs
CREATE POLICY "Block anonymous access to shared link logs"
ON public.shared_link_access_logs
FOR ALL
TO anon
USING (false);