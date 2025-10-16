-- Fix RLS policies for messages table to allow unauthenticated quote clients to send messages

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;

-- Create new INSERT policy that allows:
-- 1. Authenticated users who are conversation participants
-- 2. Service role (for edge functions)
CREATE POLICY "messages_insert_by_participants_or_service" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Allow service role (edge functions can insert on behalf of users)
  (auth.uid() IS NULL AND current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
  OR
  -- Allow authenticated users who are participants
  (
    sender_id = auth.uid() 
    AND EXISTS (
      SELECT 1 
      FROM conversations c
      WHERE c.id = messages.conversation_id 
        AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
    )
  )
);

-- Update SELECT policy to also work with service role
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;

CREATE POLICY "messages_select_by_participants_or_service"
ON public.messages
FOR SELECT
USING (
  -- Service role can see all
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR
  -- Participants can see their messages
  EXISTS (
    SELECT 1 
    FROM conversations c
    WHERE c.id = messages.conversation_id 
      AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
  )
);

COMMENT ON POLICY "messages_insert_by_participants_or_service" ON public.messages IS 
'Allows authenticated participants and service role to insert messages. Service role is used by edge functions to insert messages on behalf of unauthenticated quote clients.';