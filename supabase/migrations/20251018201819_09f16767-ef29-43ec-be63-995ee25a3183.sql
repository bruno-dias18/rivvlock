-- ============================================
-- REFACTORING: Conversations escaladées
-- Correction de l'architecture pour séparer proprement
-- les conversations Admin ↔ Seller et Admin ↔ Buyer
-- ============================================

-- 1. Rendre seller_id nullable pour les conversations admin
ALTER TABLE public.conversations 
ALTER COLUMN seller_id DROP NOT NULL;

-- 2. Corriger la fonction de création des conversations escaladées
CREATE OR REPLACE FUNCTION public.create_escalated_dispute_conversations(
  p_dispute_id uuid,
  p_admin_id uuid
)
RETURNS TABLE(seller_conversation_id uuid, buyer_conversation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_seller_conv_id uuid;
  v_buyer_conv_id uuid;
  v_existing_seller_conv uuid;
  v_existing_buyer_conv uuid;
BEGIN
  -- Récupérer la transaction
  SELECT t.* INTO v_transaction
  FROM transactions t
  JOIN disputes d ON d.transaction_id = t.id
  WHERE d.id = p_dispute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute or transaction not found';
  END IF;

  -- Vérifier si les conversations existent déjà
  SELECT id INTO v_existing_seller_conv
  FROM public.conversations
  WHERE dispute_id = p_dispute_id
    AND conversation_type = 'admin_seller_dispute'
  LIMIT 1;

  SELECT id INTO v_existing_buyer_conv
  FROM public.conversations
  WHERE dispute_id = p_dispute_id
    AND conversation_type = 'admin_buyer_dispute'
  LIMIT 1;

  -- Créer conversation Admin ↔ Seller (si n'existe pas)
  IF v_existing_seller_conv IS NULL THEN
    INSERT INTO public.conversations (
      seller_id,
      buyer_id,
      dispute_id,
      admin_id,
      conversation_type,
      status
    ) VALUES (
      v_transaction.user_id,  -- ✅ CORRECT : seller = vrai seller
      NULL,                    -- ✅ CORRECT : pas de buyer dans cette conv
      p_dispute_id,
      p_admin_id,
      'admin_seller_dispute',
      'active'
    )
    RETURNING id INTO v_seller_conv_id;
  ELSE
    v_seller_conv_id := v_existing_seller_conv;
  END IF;

  -- Créer conversation Admin ↔ Buyer (si n'existe pas)
  IF v_existing_buyer_conv IS NULL THEN
    INSERT INTO public.conversations (
      seller_id,
      buyer_id,
      dispute_id,
      admin_id,
      conversation_type,
      status
    ) VALUES (
      NULL,                       -- ✅ CORRECT : pas de seller dans cette conv
      v_transaction.buyer_id,     -- ✅ CORRECT : buyer = vrai buyer
      p_dispute_id,
      p_admin_id,
      'admin_buyer_dispute',
      'active'
    )
    RETURNING id INTO v_buyer_conv_id;
  ELSE
    v_buyer_conv_id := v_existing_buyer_conv;
  END IF;

  RETURN QUERY SELECT v_seller_conv_id, v_buyer_conv_id;
END;
$$;

-- 3. Corriger les conversations existantes mal configurées
-- Trouver et corriger admin_seller_dispute (où seller_id = admin au lieu du vrai seller)
UPDATE public.conversations c
SET seller_id = t.user_id,
    buyer_id = NULL,
    updated_at = now()
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
WHERE c.dispute_id = d.id
  AND c.conversation_type = 'admin_seller_dispute'
  AND c.seller_id = c.admin_id  -- seller_id était l'admin (bug)
  AND c.seller_id != t.user_id; -- et ce n'était pas le vrai seller

-- Corriger admin_buyer_dispute (où seller_id = admin au lieu de NULL)
UPDATE public.conversations c
SET seller_id = NULL,
    buyer_id = t.buyer_id,
    updated_at = now()
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
WHERE c.dispute_id = d.id
  AND c.conversation_type = 'admin_buyer_dispute'
  AND c.seller_id = c.admin_id  -- seller_id était l'admin (bug)
  AND c.buyer_id = t.buyer_id;

-- 4. Supprimer les conversations en double (garde la plus récente par dispute_id + type)
DELETE FROM public.conversations c1
USING public.conversations c2
WHERE c1.dispute_id = c2.dispute_id
  AND c1.conversation_type = c2.conversation_type
  AND c1.id < c2.id  -- Garde la plus récente
  AND c1.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute');

-- 5. Ajouter un commentaire pour documenter la structure
COMMENT ON COLUMN public.conversations.seller_id IS 
'Pour conversations admin: NULL pour admin_buyer_dispute, vrai seller_id pour admin_seller_dispute';

COMMENT ON COLUMN public.conversations.buyer_id IS 
'Pour conversations admin: NULL pour admin_seller_dispute, vrai buyer_id pour admin_buyer_dispute';