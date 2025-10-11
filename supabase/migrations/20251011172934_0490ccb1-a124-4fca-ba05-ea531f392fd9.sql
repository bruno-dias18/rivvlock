-- Drop la politique existante
DROP POLICY IF EXISTS "Users can archive resolved disputes" ON disputes;

-- Créer la nouvelle politique corrigée
CREATE POLICY "Users can archive resolved disputes"
ON disputes
FOR UPDATE
USING (
  -- Conditions pour pouvoir modifier (AVANT l'update)
  status IN ('resolved', 'resolved_refund', 'resolved_release')
  AND (
    -- Ne peut pas archiver si déjà archivé par quelqu'un d'autre
    deleted_by_user_id IS NULL 
    OR deleted_by_user_id = auth.uid()
  )
  AND (
    -- Doit être participant (reporter, seller, ou buyer)
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id
      AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
)
WITH CHECK (
  -- Conditions à valider APRÈS l'update
  deleted_by_user_id = auth.uid() 
  AND deleted_at IS NOT NULL
);