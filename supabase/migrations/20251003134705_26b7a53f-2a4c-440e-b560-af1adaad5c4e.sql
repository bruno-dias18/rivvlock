-- Correction des nouvelles alertes de sécurité uniquement

-- 1. Sécuriser admin_role_audit_log - restreindre aux super admins
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Only super admins can view audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- 2. Policy shared_link_access_logs déjà créée mais besoin de vérifier
-- Elle utilise check_admin_role au lieu de is_admin_secure
DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;
CREATE POLICY "Only admins can view shared link access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- 3. Définir search_path pour toutes les fonctions manquantes
CREATE OR REPLACE FUNCTION public.generate_secure_token() 
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$;