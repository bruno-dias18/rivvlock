-- Add recipient_id to dispute_messages for private conversations
ALTER TABLE public.dispute_messages 
ADD COLUMN recipient_id uuid REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX idx_dispute_messages_recipient ON public.dispute_messages(recipient_id);

-- Update RLS policies for private conversations
DROP POLICY IF EXISTS "Users can view messages from disputes they are involved in" ON public.dispute_messages;
DROP POLICY IF EXISTS "Users can create messages in disputes they are involved in" ON public.dispute_messages;

-- New policy: Users can view messages where they are sender OR recipient
CREATE POLICY "Users can view their messages in disputes"
ON public.dispute_messages
FOR SELECT
USING (
  (sender_id = auth.uid() OR recipient_id = auth.uid() OR recipient_id IS NULL)
  AND EXISTS (
    SELECT 1 FROM disputes d
    JOIN transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_messages.dispute_id
    AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- New policy: Users can create messages to specific recipients
CREATE POLICY "Users can create messages in their disputes"
ON public.dispute_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM disputes d
    JOIN transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_messages.dispute_id
    AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Admins can still see and send all messages
-- (existing admin policy should remain)