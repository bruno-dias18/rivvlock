-- Corriger la politique RLS pour l'archivage des litiges
DROP POLICY IF EXISTS "Users can archive resolved disputes" ON disputes;

CREATE POLICY "Users can archive resolved disputes"
ON disputes
FOR UPDATE
USING (
  -- Conditions AVANT l'update: qui peut faire l'action
  status::text IN ('resolved', 'resolved_refund', 'resolved_release')
  AND (
    deleted_by_user_id IS NULL 
    OR deleted_by_user_id = auth.uid()
  )
  AND (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id
      AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
)
WITH CHECK (
  -- Conditions APRÈS l'update: validation des données seulement
  deleted_at IS NOT NULL
);