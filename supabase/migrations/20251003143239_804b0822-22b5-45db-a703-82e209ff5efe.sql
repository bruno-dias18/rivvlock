-- Add explicit anonymous block policy for dispute_messages
CREATE POLICY "Block anonymous access to dispute messages"
ON public.dispute_messages
FOR ALL
TO anon
USING (false)
WITH CHECK (false);