-- ====================================
-- CORRECTION DES FONCTIONS SEARCH_PATH
-- ====================================

-- Corriger validate_invoice_participants
CREATE OR REPLACE FUNCTION public.validate_invoice_participants()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Corriger validate_dispute_message_recipient
CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RAISE NOTICE 'Dispute message without explicit recipient_id will be visible to all dispute participants';
  END IF;
  
  RETURN NEW;
END;
$$;