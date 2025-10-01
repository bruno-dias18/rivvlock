-- Create transaction_messages table with optimized structure
CREATE TABLE IF NOT EXISTS public.transaction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create composite index for efficient pagination
CREATE INDEX idx_transaction_messages_lookup ON public.transaction_messages(transaction_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view messages in their transactions
CREATE POLICY "Users can view messages in their transactions"
ON public.transaction_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_messages.transaction_id
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- RLS Policy: Users can create messages in their transactions
CREATE POLICY "Users can create messages in their transactions"
ON public.transaction_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_messages.transaction_id
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    AND t.status IN ('pending', 'paid')
  )
);

-- RLS Policy: Admins can manage all transaction messages
CREATE POLICY "Admins can manage all transaction messages"
ON public.transaction_messages
FOR ALL
USING (is_admin(auth.uid()));

-- Enable realtime for transaction_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_messages;