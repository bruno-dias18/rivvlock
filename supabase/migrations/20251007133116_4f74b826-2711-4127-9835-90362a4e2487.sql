-- Update RLS to allow broadcast dispute messages to be visible to all dispute participants
-- Drop overly strict select policy
DROP POLICY IF EXISTS "Ultra strict dispute message access" ON public.dispute_messages;

-- Create improved select policy including broadcast visibility for participants
CREATE POLICY "Participants can view dispute messages incl. broadcast"
ON public.dispute_messages
FOR SELECT
USING (
  is_admin(auth.uid())
  OR sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR (
    recipient_id IS NULL AND EXISTS (
      SELECT 1
      FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.reporter_id = auth.uid() OR
          t.user_id = auth.uid() OR
          t.buyer_id = auth.uid()
        )
    )
  )
);
