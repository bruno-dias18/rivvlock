-- Nettoyer les doublons de policies et corriger RLS

-- 1. Nettoyer admin_role_audit_log
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
-- Garder "Super admins only audit access" et "System can insert audit logs"

-- 2. Nettoyer shared_link_access_logs  
DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;
-- Garder "Admins only access logs"

-- 3. Vérifier que RLS est bien activé partout
ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_access_logs ENABLE ROW LEVEL SECURITY;

-- 4. Créer is_admin_secure si elle n'existe pas
CREATE OR REPLACE FUNCTION public.is_admin_secure(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_admin_role(check_user_id)
$$;