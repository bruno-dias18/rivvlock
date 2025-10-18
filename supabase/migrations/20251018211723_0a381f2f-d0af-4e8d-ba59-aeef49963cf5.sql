-- Bloquer les propositions utilisateurs si le litige est escaladé ou a déjà un admin impliqué
-- Mise à jour de la politique INSERT sur dispute_proposals

DROP POLICY IF EXISTS "Users can create proposals in their disputes" ON public.dispute_proposals;

CREATE POLICY "Users can create proposals in their disputes"
ON public.dispute_proposals
FOR INSERT
WITH CHECK (
  proposer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
      AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
      AND d.status IN ('open', 'responded', 'negotiating')
      AND d.escalated_at IS NULL
      AND d.status != 'escalated'
  )
);