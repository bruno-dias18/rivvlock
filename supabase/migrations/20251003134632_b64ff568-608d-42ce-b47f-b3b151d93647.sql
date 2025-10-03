-- Corriger les dernières alertes de sécurité

-- 1. Sécuriser admin_role_audit_log (actuellement publique)
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Super admins only audit access"
ON public.admin_role_audit_log
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- 2. Fonction is_admin_secure qui utilise check_admin_role
CREATE OR REPLACE FUNCTION public.is_admin_secure(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_admin_role(check_user_id)
$$;

-- 3. Corriger shared_link_access_logs policy avec fonction sécurisée
DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;
CREATE POLICY "Admins only access logs"
ON public.shared_link_access_logs
FOR ALL
TO authenticated
USING (is_admin_secure(auth.uid()))
WITH CHECK (is_admin_secure(auth.uid()));

-- 4. Corriger toutes les fonctions pour avoir search_path fixe
CREATE OR REPLACE FUNCTION public.log_admin_profile_access(
  accessed_user_id uuid, 
  admin_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_access_logs (
    accessed_profile_id,
    accessed_by_user_id,
    access_type,
    accessed_fields
  ) VALUES (
    accessed_user_id,
    admin_user_id,
    'admin_profile_access',
    ARRAY['all_fields']
  );
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_stripe_admin_access(
  accessed_user_id uuid, 
  admin_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_access_logs (
    accessed_profile_id,
    accessed_by_user_id,
    access_type,
    accessed_fields
  ) VALUES (
    accessed_user_id,
    admin_user_id,
    'admin_stripe_access',
    ARRAY['stripe_account_data']
  );
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

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