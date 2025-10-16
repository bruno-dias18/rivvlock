-- Drop existing policies for messages table
DROP POLICY IF EXISTS "messages_insert_by_participants_or_service" ON public.messages;
DROP POLICY IF EXISTS "messages_select_by_participants_or_service" ON public.messages;

-- Create new INSERT policy: service_role OR authenticated participants (including quote clients)
CREATE POLICY "messages_insert_participants_or_quote_client"
ON public.messages
FOR INSERT
TO authenticated, service_role
WITH CHECK (
  -- Service role can always insert
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  OR
  -- Authenticated users who are seller_id, buyer_id, OR quote client
  (
    sender_id = auth.uid() 
    AND (
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
          AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
      )
      OR
      -- Allow if user is the client of the quote linked to this conversation
      EXISTS (
        SELECT 1 FROM conversations c
        JOIN quotes q ON q.id = c.quote_id
        WHERE c.id = messages.conversation_id
          AND q.client_user_id = auth.uid()
      )
    )
  )
);

-- Create new SELECT policy: service_role OR authenticated participants (including quote clients)
CREATE POLICY "messages_select_participants_or_quote_client"
ON public.messages
FOR SELECT
TO authenticated, service_role
USING (
  -- Service role can always select
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  OR
  -- Authenticated users who are seller_id, buyer_id, OR quote client
  (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.seller_id = auth.uid() OR c.buyer_id = auth.uid())
    )
    OR
    -- Allow if user is the client of the quote linked to this conversation
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN quotes q ON q.id = c.quote_id
      WHERE c.id = messages.conversation_id
        AND q.client_user_id = auth.uid()
    )
  )
);

-- Keep existing admin policy (if it exists)
-- The messages_select_admin policy should remain unchanged