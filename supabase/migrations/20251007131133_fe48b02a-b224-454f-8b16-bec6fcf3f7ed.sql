-- Drop old restrictive UPDATE policy for dispute_proposals
DROP POLICY IF EXISTS "Users can update their own proposals" ON public.dispute_proposals;

-- Create new policy allowing both proposer and transaction participants to update
CREATE POLICY "Users can update proposals they're involved in"
ON public.dispute_proposals
FOR UPDATE
USING (
  proposer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
      AND (
        d.reporter_id = auth.uid()
        OR t.user_id = auth.uid()
        OR t.buyer_id = auth.uid()
      )
  )
)
WITH CHECK (
  proposer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
      AND (
        d.reporter_id = auth.uid()
        OR t.user_id = auth.uid()
        OR t.buyer_id = auth.uid()
      )
  )
);