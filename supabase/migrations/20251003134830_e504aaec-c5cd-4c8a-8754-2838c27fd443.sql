-- Vérifier et activer RLS sur toutes les tables nécessaires
ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;

-- Recréer les policies maintenant que RLS est activé
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Only super admins can view audit logs"
ON public.admin_role_audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can view shared link access logs" ON public.shared_link_access_logs;  
CREATE POLICY "Only admins can view shared link access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- Corriger toutes les fonctions sans search_path défini
CREATE OR REPLACE FUNCTION public.validate_invoice_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RAISE EXCEPTION 'seller_id cannot be null';
  END IF;
  
  IF NEW.buyer_id IS NULL THEN
    RAISE EXCEPTION 'buyer_id cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_sensitive_transaction_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    NEW.stripe_payment_intent_id = NULL;
  END IF;
  RETURN NEW;
END;
$$;