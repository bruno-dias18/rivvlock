-- Update RLS policies to allow users to view transactions where they are either seller or buyer
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

-- Allow users to view transactions where they are seller OR buyer
CREATE POLICY "Users can view transactions where they are participants" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = buyer_id);

-- Allow users to update transactions where they are seller OR buyer
CREATE POLICY "Users can update transactions where they are participants" 
ON public.transactions 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = buyer_id);