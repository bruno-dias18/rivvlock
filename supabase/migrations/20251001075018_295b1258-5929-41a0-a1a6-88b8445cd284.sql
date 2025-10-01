-- Create transaction_messages table for direct communication between buyer and seller
CREATE TABLE IF NOT EXISTS public.transaction_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_transaction_messages_transaction_id ON public.transaction_messages(transaction_id);
CREATE INDEX idx_transaction_messages_created_at ON public.transaction_messages(created_at);

-- Enable RLS
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their transactions
CREATE POLICY "Users can view messages from their transactions"
ON public.transaction_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_messages.transaction_id
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Users can send messages in their transactions
CREATE POLICY "Users can send messages in their transactions"
ON public.transaction_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_messages.transaction_id
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.transaction_messages
FOR SELECT
USING (is_admin(auth.uid()));

-- Enable realtime for transaction_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_messages;