-- Backfill and sync for dispute conversations
-- 1) Backfill missing dispute_id on dispute-related conversations
UPDATE public.conversations c
SET dispute_id = d.id, updated_at = now()
FROM public.disputes d
WHERE c.dispute_id IS NULL
  AND d.conversation_id IS NOT NULL
  AND c.id = d.conversation_id
  AND c.conversation_type IN ('admin_seller_dispute','admin_buyer_dispute');

-- 2) Trigger to keep conversations.dispute_id in sync when disputes are created/updated
CREATE OR REPLACE FUNCTION public.sync_dispute_to_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET dispute_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.conversation_id
      AND (dispute_id IS NULL OR dispute_id != NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dispute_to_conversation ON public.disputes;
CREATE TRIGGER trg_sync_dispute_to_conversation
AFTER INSERT OR UPDATE OF conversation_id ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.sync_dispute_to_conversation();

-- 3) Best-effort trigger to populate conversations.dispute_id when a conversation is created/updated
CREATE OR REPLACE FUNCTION public.sync_conversation_to_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.dispute_id IS NULL THEN
    UPDATE public.conversations c
    SET dispute_id = d.id,
        updated_at = now()
    FROM public.disputes d
    WHERE c.id = NEW.id
      AND d.conversation_id = NEW.id
      AND (c.dispute_id IS NULL OR c.dispute_id != d.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_to_dispute ON public.conversations;
CREATE TRIGGER trg_sync_conversation_to_dispute
AFTER INSERT OR UPDATE OF conversation_type, dispute_id ON public.conversations
FOR EACH ROW
WHEN (NEW.conversation_type IN ('admin_seller_dispute','admin_buyer_dispute'))
EXECUTE FUNCTION public.sync_conversation_to_dispute();