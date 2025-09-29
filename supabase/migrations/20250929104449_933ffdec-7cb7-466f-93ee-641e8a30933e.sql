-- Add DELETE policy for expired transactions
CREATE POLICY "Users can delete their own expired transactions" 
ON public.transactions 
FOR DELETE 
USING (
  (auth.uid() = user_id OR auth.uid() = buyer_id) 
  AND status = 'expired'::transaction_status
);