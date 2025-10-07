-- Update RLS to allow creating proposals when a dispute is open, responded, or negotiating
-- 1) Drop the overly restrictive INSERT policy on dispute_proposals
DROP POLICY IF EXISTS "Users can create proposals in their disputes" ON public.dispute_proposals;

-- 2) Recreate INSERT policy with broader allowed dispute statuses
CREATE POLICY "Users can create proposals in their disputes"
ON public.dispute_proposals
FOR INSERT
WITH CHECK (
  proposer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
      AND (
        d.reporter_id = auth.uid()
        OR t.user_id = auth.uid()
        OR t.buyer_id = auth.uid()
      )
      AND d.status IN ('open', 'responded', 'negotiating')
  )
);
