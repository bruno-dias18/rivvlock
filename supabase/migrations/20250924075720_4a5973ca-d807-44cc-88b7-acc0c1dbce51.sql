-- Add RLS policy to allow transaction participants to view each other's Stripe account status
CREATE POLICY "Transaction participants can view each other's stripe accounts" 
ON public.stripe_accounts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.transactions t 
    WHERE (t.user_id = auth.uid() AND t.buyer_id = stripe_accounts.user_id)
       OR (t.buyer_id = auth.uid() AND t.user_id = stripe_accounts.user_id)
  )
);