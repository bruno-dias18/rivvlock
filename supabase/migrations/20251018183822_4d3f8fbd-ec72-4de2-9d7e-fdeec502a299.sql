-- Fix specific dispute #125f941b and prevent future issues
UPDATE public.conversations 
SET dispute_id = '125f941b-c972-41a4-b551-35ed2becb978'::uuid,
    conversation_type = 'dispute',
    updated_at = now()
WHERE id = '9a684f60-482d-4a7b-850d-241502bb03ea'::uuid;

-- Enhanced trigger to ensure ALL new disputes get proper conversation sync
CREATE OR REPLACE FUNCTION public.sync_dispute_conversation_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a dispute is created/updated, ensure the conversation is properly configured
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET dispute_id = NEW.id,
        conversation_type = 'dispute',
        updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace existing trigger with the enhanced one
DROP TRIGGER IF EXISTS trg_sync_dispute_to_conversation ON public.disputes;
CREATE TRIGGER trg_sync_dispute_to_conversation
AFTER INSERT OR UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.sync_dispute_conversation_complete();