-- ============================================
-- PHASE 1: Unification messagerie litiges (corrigée)
-- ============================================

-- 1. Créer l'enum conversation_type s'il n'existe pas
DO $$ BEGIN
  CREATE TYPE public.conversation_type AS ENUM (
    'transaction',
    'quote',
    'admin_seller_dispute',
    'admin_buyer_dispute'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Ajouter conversation_type à conversations si pas déjà présent
DO $$ BEGIN
  ALTER TABLE public.conversations 
  ADD COLUMN conversation_type public.conversation_type NOT NULL DEFAULT 'transaction';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 3. Mettre à jour les types existants
UPDATE public.conversations
SET conversation_type = CASE
  WHEN transaction_id IS NOT NULL THEN 'transaction'::public.conversation_type
  WHEN quote_id IS NOT NULL THEN 'quote'::public.conversation_type
  ELSE 'transaction'::public.conversation_type
END
WHERE conversation_type = 'transaction';

-- 4. Ajouter admin_id pour les conversations admin si pas déjà présent
DO $$ BEGIN
  ALTER TABLE public.conversations
  ADD COLUMN admin_id uuid REFERENCES auth.users(id);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 5. Créer index pour performance seulement s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_conversations_dispute_id ON public.conversations(dispute_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin_id ON public.conversations(admin_id);

-- 6. Adapter les RLS policies pour les conversations de litiges
DROP POLICY IF EXISTS "conversations_select_participants" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_participants_or_admin" ON public.conversations;

CREATE POLICY "conversations_select_participants_or_admin"
ON public.conversations
FOR SELECT
USING (
  -- Participants normaux (transaction/quote)
  (seller_id = auth.uid() OR buyer_id = auth.uid())
  OR
  -- Admin dans conversations admin_*_dispute
  (conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute') AND admin_id = auth.uid())
  OR
  -- Super admin voit tout
  is_admin(auth.uid())
);

-- 7. Adapter RLS policies pour messages
DROP POLICY IF EXISTS "messages_select_participants_or_quote_client" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participants_or_quote_client" ON public.messages;
DROP POLICY IF EXISTS "messages_select_extended" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_extended" ON public.messages;

CREATE POLICY "messages_select_extended"
ON public.messages
FOR SELECT
USING (
  ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  OR
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
    AND (
      -- Participants normaux
      (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
      OR
      -- Admin dans conversations admin
      (c.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute') AND c.admin_id = auth.uid())
    )
  )
  OR
  -- Quote client
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN quotes q ON q.id = c.quote_id
    WHERE c.id = messages.conversation_id
    AND q.client_user_id = auth.uid()
  )
);

CREATE POLICY "messages_insert_extended"
ON public.messages
FOR INSERT
WITH CHECK (
  ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  OR
  (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (
          (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
          OR
          (c.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute') AND c.admin_id = auth.uid())
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM conversations c
        JOIN quotes q ON q.id = c.quote_id
        WHERE c.id = messages.conversation_id
        AND q.client_user_id = auth.uid()
      )
    )
  )
);

-- 8. SUPPRIMER les anciennes tables dispute_messages
DROP TABLE IF EXISTS public.dispute_message_reads CASCADE;
DROP TABLE IF EXISTS public.dispute_messages CASCADE;

-- 9. Fonction helper pour créer conversations de litiges escaladés
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
BEGIN
  -- Récupérer la transaction
  SELECT t.* INTO v_transaction
  FROM transactions t
  JOIN disputes d ON d.transaction_id = t.id
  WHERE d.id = p_dispute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute or transaction not found';
  END IF;

  -- Créer conversation Admin ↔ Seller
  INSERT INTO public.conversations (
    seller_id,
    buyer_id,
    dispute_id,
    admin_id,
    conversation_type,
    status
  ) VALUES (
    p_admin_id,
    v_transaction.user_id, -- seller
    p_dispute_id,
    p_admin_id,
    'admin_seller_dispute',
    'active'
  )
  RETURNING id INTO v_seller_conv_id;

  -- Créer conversation Admin ↔ Buyer
  INSERT INTO public.conversations (
    seller_id,
    buyer_id,
    dispute_id,
    admin_id,
    conversation_type,
    status
  ) VALUES (
    p_admin_id,
    v_transaction.buyer_id,
    p_dispute_id,
    p_admin_id,
    'admin_buyer_dispute',
    'active'
  )
  RETURNING id INTO v_buyer_conv_id;

  RETURN QUERY SELECT v_seller_conv_id, v_buyer_conv_id;
END;
$$;