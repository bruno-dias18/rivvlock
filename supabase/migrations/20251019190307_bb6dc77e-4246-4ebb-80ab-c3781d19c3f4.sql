
-- ============================================
-- PHASE 5 - RÉPARATION: Triggers de synchronisation bidirectionnelle
-- ============================================

-- 1. Recréer le trigger disputes → conversations
CREATE OR REPLACE FUNCTION public.sync_dispute_conversation_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quand un dispute obtient un conversation_id, mettre à jour la conversation
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET dispute_id = NEW.id,
        conversation_type = 'dispute',
        updated_at = now()
    WHERE id = NEW.conversation_id
      AND (dispute_id IS NULL OR dispute_id != NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dispute_to_conversation ON public.disputes;
CREATE TRIGGER trg_sync_dispute_to_conversation
AFTER INSERT OR UPDATE OF conversation_id ON public.disputes
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION public.sync_dispute_conversation_complete();

-- 2. Recréer le trigger conversations → disputes
CREATE OR REPLACE FUNCTION public.sync_conversation_to_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quand une conversation obtient un dispute_id, mettre à jour le dispute
  IF NEW.dispute_id IS NOT NULL THEN
    UPDATE public.disputes
    SET conversation_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.dispute_id
      AND (conversation_id IS NULL OR conversation_id != NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_to_dispute ON public.conversations;
CREATE TRIGGER trg_sync_conversation_to_dispute
AFTER INSERT OR UPDATE OF dispute_id ON public.conversations
FOR EACH ROW
WHEN (NEW.dispute_id IS NOT NULL)
EXECUTE FUNCTION public.sync_conversation_to_dispute();

-- 3. Réparer le litige orphelin existant
DO $$
DECLARE
  v_dispute_id uuid := '27964f7d-c92b-4768-8f63-95fa57255102';
  v_conversation_id uuid;
  v_transaction_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
BEGIN
  -- Récupérer les infos du litige
  SELECT d.transaction_id, t.user_id, t.buyer_id
  INTO v_transaction_id, v_seller_id, v_buyer_id
  FROM disputes d
  JOIN transactions t ON t.id = d.transaction_id
  WHERE d.id = v_dispute_id;

  -- Créer une conversation publique pour ce litige
  INSERT INTO public.conversations (
    seller_id,
    buyer_id,
    transaction_id,
    conversation_type,
    dispute_id,
    status
  ) VALUES (
    v_seller_id,
    v_buyer_id,
    v_transaction_id,
    'dispute',
    v_dispute_id,
    'active'
  )
  RETURNING id INTO v_conversation_id;

  -- Lier la conversation au litige (le trigger fera la mise à jour inverse)
  UPDATE public.disputes
  SET conversation_id = v_conversation_id,
      updated_at = now()
  WHERE id = v_dispute_id;

  RAISE NOTICE 'Litige % réparé avec conversation %', v_dispute_id, v_conversation_id;
END $$;

-- 4. Script de détection/réparation automatique pour tous les litiges orphelins futurs
CREATE OR REPLACE FUNCTION public.repair_orphan_disputes()
RETURNS TABLE(dispute_id uuid, conversation_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dispute record;
  v_conv_id uuid;
BEGIN
  FOR v_dispute IN
    SELECT d.id, d.transaction_id, t.user_id as seller_id, t.buyer_id
    FROM disputes d
    JOIN transactions t ON t.id = d.transaction_id
    WHERE d.conversation_id IS NULL
      AND d.status NOT IN ('resolved', 'resolved_refund', 'resolved_release')
  LOOP
    -- Créer conversation
    INSERT INTO public.conversations (
      seller_id,
      buyer_id,
      transaction_id,
      conversation_type,
      dispute_id,
      status
    ) VALUES (
      v_dispute.seller_id,
      v_dispute.buyer_id,
      v_dispute.transaction_id,
      'dispute',
      v_dispute.id,
      'active'
    )
    RETURNING id INTO v_conv_id;

    -- Lier au dispute
    UPDATE public.disputes
    SET conversation_id = v_conv_id,
        updated_at = now()
    WHERE id = v_dispute.id;

    RETURN QUERY SELECT v_dispute.id, v_conv_id, 'repaired'::text;
  END LOOP;
END;
$$;
