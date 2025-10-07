-- Drop existing policy
DROP POLICY IF EXISTS "Users can update proposals they're involved in" ON public.dispute_proposals;

-- Recreate the policy with correct permissions
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
);