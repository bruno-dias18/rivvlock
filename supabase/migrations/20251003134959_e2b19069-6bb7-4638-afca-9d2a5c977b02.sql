-- NETTOYAGE FINAL - Supprimer les policies publiques et les doublons

-- 1. Nettoyer admin_role_audit_log
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_role_audit_log;

-- Garder uniquement les policies strictes
-- "Super admins can read audit logs" (SELECT)
-- "Super admins can manage audit logs" (INSERT)

-- 2. Nettoyer shared_link_access_logs
DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;

-- Garder uniquement:
-- "Admins can read access logs" (SELECT)
-- "System can log access attempts" (INSERT) avec authenticated seulement

-- 3. Recréer la policy d'insertion pour shared_link_access_logs SANS public role
DROP POLICY IF EXISTS "System can log access attempts" ON public.shared_link_access_logs;
CREATE POLICY "System can log access attempts"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated  -- Seulement authenticated, pas public
WITH CHECK (true);