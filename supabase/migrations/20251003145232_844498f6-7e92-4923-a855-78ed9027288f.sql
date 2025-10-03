-- Cleanup public-role policies to avoid false positives
DROP POLICY IF EXISTS "Block public SELECT on audit logs" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "Block public SELECT on access logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "No deletes allowed on access logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "No updates allowed on access logs" ON public.shared_link_access_logs;

-- Enforce RLS strictly
ALTER TABLE public.admin_role_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;