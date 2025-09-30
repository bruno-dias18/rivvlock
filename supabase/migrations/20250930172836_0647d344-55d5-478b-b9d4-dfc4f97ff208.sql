-- Allow users to delete resolved disputes they are involved in
CREATE POLICY "Users can delete resolved disputes they are involved in"
ON public.disputes
FOR DELETE
USING (
  status IN ('resolved', 'resolved_refund', 'resolved_release')
  AND (
    reporter_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = disputes.transaction_id 
      AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
);