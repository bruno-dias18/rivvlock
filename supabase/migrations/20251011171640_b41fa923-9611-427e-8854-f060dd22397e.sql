-- Add archiving columns to disputes table
ALTER TABLE public.disputes
ADD COLUMN deleted_by_user_id uuid,
ADD COLUMN deleted_at timestamp with time zone;

-- Create index for better query performance
CREATE INDEX idx_disputes_deleted_by ON public.disputes(deleted_by_user_id, deleted_at);

-- Add comments for documentation
COMMENT ON COLUMN public.disputes.deleted_by_user_id IS 'User who archived this dispute from their view';
COMMENT ON COLUMN public.disputes.deleted_at IS 'Timestamp when the dispute was archived';

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Users can view disputes without admin notes" ON public.disputes;

-- Create new SELECT policy that filters archived disputes for users (but not admins)
CREATE POLICY "Users can view their active disputes" ON public.disputes
FOR SELECT
USING (
  (
    (reporter_id = auth.uid() AND (deleted_by_user_id IS NULL OR deleted_by_user_id != auth.uid()))
    OR 
    (EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id
      AND (
        (t.user_id = auth.uid() AND (deleted_by_user_id IS NULL OR deleted_by_user_id != auth.uid()))
        OR 
        (t.buyer_id = auth.uid() AND (deleted_by_user_id IS NULL OR deleted_by_user_id != auth.uid()))
      )
    ))
    OR 
    is_admin(auth.uid())
  )
);

-- Drop old DELETE policy
DROP POLICY IF EXISTS "Users can delete resolved disputes they are involved in" ON public.disputes;

-- Create new UPDATE policy for archiving
CREATE POLICY "Users can archive resolved disputes" ON public.disputes
FOR UPDATE
USING (
  (status IN ('resolved', 'resolved_refund', 'resolved_release'))
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
  deleted_by_user_id = auth.uid()
  AND deleted_at IS NOT NULL
);