-- ====================================
-- SECURITY HARDENING MIGRATION (Idempotent)
-- Protège les données personnelles et financières
-- ====================================

-- 1. Créer le type enum pour les rôles si nécessaire
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'super_admin');
  END IF;
END $$;

-- 2. Fonction sécurisée pour vérifier le super-admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_roles ar 
    WHERE ar.user_id = check_user_id 
    AND ar.role = 'super_admin'
  )
$$;

-- 3. Fonction pour obtenir uniquement les champs non-sensibles du profil
CREATE OR REPLACE FUNCTION public.get_safe_profile(profile_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  verified boolean,
  user_type user_type,
  country country_code,
  company_name text,
  registration_complete boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (auth.uid() = profile_user_id OR is_admin(auth.uid())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.verified,
    p.user_type,
    p.country,
    p.company_name,
    p.registration_complete
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
END;
$$;

-- 4. Créer la table d'audit si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.admin_role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  old_role text,
  new_role text,
  operation text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS pour audit log (avec DROP IF EXISTS)
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Only super admins can view audit logs"
ON public.admin_role_audit_log
FOR SELECT
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_role_audit_log;
CREATE POLICY "System can insert audit logs"
ON public.admin_role_audit_log
FOR INSERT
WITH CHECK (true);

-- 6. Fonction de validation pour invoice participants
CREATE OR REPLACE FUNCTION public.validate_invoice_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RAISE EXCEPTION 'seller_id cannot be null';
  END IF;
  
  IF NEW.buyer_id IS NULL THEN
    RAISE EXCEPTION 'buyer_id cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invoice_participants_trigger ON public.invoices;
CREATE TRIGGER validate_invoice_participants_trigger
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_invoice_participants();

-- 7. Politique RLS renforcée pour invoices
DROP POLICY IF EXISTS "Strict invoice participant access v2" ON public.invoices;
CREATE POLICY "Strict invoice participant access v2"
ON public.invoices
FOR SELECT
USING (
  (auth.uid() = seller_id AND seller_id IS NOT NULL) 
  OR (auth.uid() = buyer_id AND buyer_id IS NOT NULL)
  OR is_admin(auth.uid())
);

-- 8. Validation pour dispute_messages
CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RAISE NOTICE 'Dispute message without explicit recipient_id will be visible to all dispute participants';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_dispute_message_recipient_trigger ON public.dispute_messages;
CREATE TRIGGER validate_dispute_message_recipient_trigger
BEFORE INSERT ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_dispute_message_recipient();

-- 9. Trigger pour logger les changements de rôles admin
CREATE OR REPLACE FUNCTION public.log_admin_role_change_detailed()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_role_audit_log (
      changed_by_user_id,
      target_user_id,
      old_role,
      new_role,
      operation
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.user_id,
      NULL,
      NEW.role::text,
      'INSERT'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_role_audit_log (
      changed_by_user_id,
      target_user_id,
      old_role,
      new_role,
      operation
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.user_id,
      OLD.role::text,
      NEW.role::text,
      'UPDATE'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_role_audit_log (
      changed_by_user_id,
      target_user_id,
      old_role,
      new_role,
      operation
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      OLD.user_id,
      OLD.role::text,
      NULL,
      'DELETE'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS admin_role_change_audit_trigger ON public.admin_roles;
CREATE TRIGGER admin_role_change_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.admin_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_role_change_detailed();

-- 10. Fonction de validation des tokens
CREATE OR REPLACE FUNCTION public.validate_shared_link_token(
  p_token text,
  p_transaction_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction record;
BEGIN
  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF v_transaction.shared_link_token != p_token THEN
    RETURN false;
  END IF;
  
  IF v_transaction.shared_link_expires_at < now() THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;