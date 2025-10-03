-- CORRECTION FINALE - Sécuriser les nouvelles tables et fonctions

-- 1. Corriger les RLS sur admin_role_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;

CREATE POLICY "System can insert audit logs"
ON public.admin_role_audit_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only super admins can view audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- 2. Corriger les RLS sur shared_link_access_logs
DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;

CREATE POLICY "Only admins can view shared link access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 3. Ajouter search_path aux fonctions existantes qui en manquent
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

CREATE OR REPLACE FUNCTION public.secure_shared_link_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shared_link_token IS NOT NULL THEN
    IF LENGTH(NEW.shared_link_token) < 20 THEN
      NEW.shared_link_token := generate_secure_token();
    END IF;
    
    IF NEW.shared_link_expires_at IS NULL OR 
       NEW.shared_link_expires_at > (now() + interval '7 days') THEN
      NEW.shared_link_expires_at := now() + interval '24 hours';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ajouter le trigger si pas encore fait
DROP TRIGGER IF EXISTS trg_secure_shared_link ON public.transactions;
CREATE TRIGGER trg_secure_shared_link
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.secure_shared_link_token();

CREATE OR REPLACE FUNCTION public.validate_shared_link_secure(
  p_token text, 
  p_transaction_id uuid,
  p_ip_address text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_recent_attempts integer;
  v_is_valid boolean := false;
BEGIN
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent_attempts
    FROM public.shared_link_access_logs
    WHERE ip_address = p_ip_address
      AND accessed_at > (now() - interval '1 hour')
      AND success = false;
    
    IF v_recent_attempts >= 10 THEN
      INSERT INTO public.shared_link_access_logs (
        transaction_id, token_used, ip_address, success, error_reason
      ) VALUES (
        p_transaction_id, p_token, p_ip_address, false, 'Rate limit exceeded'
      );
      RETURN false;
    END IF;
  END IF;

  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id;
  
  IF v_transaction.shared_link_token = p_token AND 
     v_transaction.shared_link_expires_at > now() THEN
    v_is_valid := true;
  END IF;
  
  INSERT INTO public.shared_link_access_logs (
    transaction_id, token_used, ip_address, success, error_reason
  ) VALUES (
    p_transaction_id, p_token, p_ip_address, v_is_valid,
    CASE WHEN NOT v_is_valid THEN 'Invalid or expired token' ELSE NULL END
  );
  
  RETURN v_is_valid;
END;
$$;