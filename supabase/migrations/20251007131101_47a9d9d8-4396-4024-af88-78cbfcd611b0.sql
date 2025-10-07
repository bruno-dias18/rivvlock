-- Create RLS policy to allow rejecting proposals via edge function
CREATE POLICY "Service role can update proposal status"
ON public.dispute_proposals
FOR UPDATE
TO service_role
USING (true);