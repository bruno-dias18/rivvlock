-- ========================================
-- UNIFIED MESSAGING ARCHITECTURE (Fixed Order)
-- ========================================
-- Creates a single messaging table for quotes/transactions/disputes (non-escalated)
-- Preserves dispute_messages for escalated disputes (admin channel)

-- Step 1: Create conversations table FIRST
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  dispute_id uuid REFERENCES public.disputes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_seller ON public.conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON public.conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_quote ON public.conversations(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_transaction ON public.conversations(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_dispute ON public.conversations(dispute_id) WHERE dispute_id IS NOT NULL;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "conversations_select_participants"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

CREATE POLICY "conversations_select_admin"
ON public.conversations
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "conversations_block_anonymous"
ON public.conversations
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Step 2: Create messages table (NOW conversations exists)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(trim(message)) > 0 AND length(message) <= 1000),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'proposal_update')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "messages_select_participants"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
    AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
  )
);

CREATE POLICY "messages_insert_participants"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
    AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
  )
);

CREATE POLICY "messages_select_admin"
ON public.messages
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "messages_block_anonymous"
ON public.messages
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Step 3: Add conversation_id to existing tables
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_conversation ON public.quotes(conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_conversation ON public.transactions(conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE public.disputes
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_conversation ON public.disputes(conversation_id) WHERE conversation_id IS NOT NULL;