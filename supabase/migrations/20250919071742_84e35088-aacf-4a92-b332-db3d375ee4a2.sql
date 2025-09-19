-- Add RLS policy to allow admins to view all transactions
CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
USING (public.is_admin(auth.uid()));