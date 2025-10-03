-- ====================================
-- CORRECTION DES AVERTISSEMENTS DE SÉCURITÉ
-- Fixe les fonctions avec search_path mutable
-- ====================================

-- 1. Corriger toutes les fonctions existantes pour définir search_path
CREATE OR REPLACE FUNCTION public.validate_invoice_participants()
RETURNS TRIGGER
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

CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RAISE NOTICE 'Dispute message without explicit recipient_id will be visible to all dispute participants';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Créer un index pour améliorer les performances des validations
CREATE INDEX IF NOT EXISTS idx_invoices_seller_buyer ON public.invoices(seller_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shared_link ON public.transactions(shared_link_token, shared_link_expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_role ON public.admin_roles(user_id, role);

-- 3. Documentation des améliorations de sécurité
COMMENT ON FUNCTION public.validate_invoice_participants() IS 
'Trigger pour garantir que seller_id et buyer_id sont toujours renseignés dans les factures';

COMMENT ON FUNCTION public.validate_dispute_message_recipient() IS 
'Trigger pour logger les messages de litige sans destinataire explicite';

COMMENT ON FUNCTION public.validate_shared_link_token(text, uuid) IS 
'Valide qu un token de lien partagé est valide et non expiré pour une transaction donnée';