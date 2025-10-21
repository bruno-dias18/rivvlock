-- Permettre aux utilisateurs authentifiés de s'assigner comme buyer_id
-- sur les transactions où buyer_id est NULL et où ils ne sont pas le seller
CREATE POLICY "Users can assign themselves as buyer"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  buyer_id IS NULL 
  AND auth.uid() != user_id
)
WITH CHECK (
  buyer_id = auth.uid()
  AND auth.uid() != user_id
);