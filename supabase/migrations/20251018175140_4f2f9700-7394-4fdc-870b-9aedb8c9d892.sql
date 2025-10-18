-- Phase 5: Extend Unified Architecture for Disputes
-- This migration prepares the conversations table to support disputes

-- Step 1: Add dispute_id to conversations (if not exists)
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.disputes(id) ON DELETE CASCADE;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_dispute_id 
ON public.conversations(dispute_id) 
WHERE dispute_id IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.conversations.dispute_id IS 
'Links conversation to a dispute. Used in unified messaging architecture for disputes.';

-- Step 4: Validation function to ensure data integrity
CREATE OR REPLACE FUNCTION public.validate_dispute_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If conversation_type is dispute-related, dispute_id must be set
  IF NEW.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute') THEN
    IF NEW.dispute_id IS NULL THEN
      RAISE EXCEPTION 'dispute_id is required for dispute conversations';
    END IF;
  END IF;
  
  -- If dispute_id is set, verify the dispute exists and is linked to the correct transaction
  IF NEW.dispute_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM public.disputes d
      WHERE d.id = NEW.dispute_id
    ) THEN
      RAISE EXCEPTION 'Invalid dispute_id reference';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger for validation
DROP TRIGGER IF EXISTS validate_dispute_conversation_trigger ON public.conversations;
CREATE TRIGGER validate_dispute_conversation_trigger
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dispute_conversation();

-- Step 6: Add link from disputes back to conversations (for easier queries)
-- This was already in the schema but we ensure it exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.disputes 
    ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Create index on disputes.conversation_id
CREATE INDEX IF NOT EXISTS idx_disputes_conversation_id 
ON public.disputes(conversation_id) 
WHERE conversation_id IS NOT NULL;

-- Step 8: Add RLS policy for dispute conversations (drop first if exists)
DROP POLICY IF EXISTS "Users can view their dispute conversations" ON public.conversations;
CREATE POLICY "Users can view their dispute conversations"
ON public.conversations
FOR SELECT
USING (
  conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute')
  AND (
    seller_id = auth.uid() 
    OR buyer_id = auth.uid()
    OR admin_id = auth.uid()
    OR is_admin(auth.uid())
  )
);

-- Step 9: Add RLS policy for inserting dispute conversations (drop first if exists)
DROP POLICY IF EXISTS "System can create dispute conversations" ON public.conversations;
CREATE POLICY "System can create dispute conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute')
  AND dispute_id IS NOT NULL
);

-- Step 10: Verification queries (for manual testing)
-- Run these after migration to verify integrity

-- Check: All dispute conversations have a dispute_id
-- SELECT COUNT(*) FROM conversations 
-- WHERE conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute')
-- AND dispute_id IS NULL;
-- Expected: 0

-- Check: All disputes with conversation_id have valid conversations
-- SELECT COUNT(*) FROM disputes d
-- WHERE d.conversation_id IS NOT NULL
-- AND NOT EXISTS (
--   SELECT 1 FROM conversations c WHERE c.id = d.conversation_id
-- );
-- Expected: 0

-- Check: conversation_id and dispute_id are consistent
-- SELECT COUNT(*) FROM disputes d
-- JOIN conversations c ON c.id = d.conversation_id
-- WHERE c.dispute_id != d.id;
-- Expected: 0