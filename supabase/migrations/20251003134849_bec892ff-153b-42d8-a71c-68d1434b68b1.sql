-- Corriger les policies pour qu'elles ne soient plus publiquement lisibles

-- 1. Corriger admin_role_audit_log avec des policies spécifiques
DROP POLICY IF EXISTS "Super admins only audit access" ON public.admin_role_audit_log;

CREATE POLICY "Super admins can read audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage audit logs"
ON public.admin_role_audit_log
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- 2. Corriger shared_link_access_logs avec des policies spécifiques
DROP POLICY IF EXISTS "Admins only access logs" ON public.shared_link_access_logs;

CREATE POLICY "Admins can read access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (is_admin_secure(auth.uid()));

CREATE POLICY "System can log access attempts"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true); -- Permettre l'insertion pour logging automatique

-- 3. S'assurer qu'il n'y a pas de policy par défaut permissive
-- Vérifier qu'aucune policy ne permet l'accès public