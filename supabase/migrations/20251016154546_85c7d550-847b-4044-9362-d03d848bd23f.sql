
-- Mirror old messaging tables into unified messages to allow safe code migration

-- 1) Create function + trigger for transaction_messages inserts
CREATE OR REPLACE FUNCTION public.mirror_transaction_message_to_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  -- Ensure a conversation exists for this transaction
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE transaction_id = NEW.transaction_id
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (transaction_id, seller_id, buyer_id, status)
    SELECT t.id, t.user_id, t.buyer_id, 'active'
    FROM public.transactions t
    WHERE t.id = NEW.transaction_id
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Mirror insert into messages with legacy id in metadata
  INSERT INTO public.messages (conversation_id, sender_id, message, message_type, metadata, created_at)
  VALUES (
    v_conversation_id,
    NEW.sender_id,
    NEW.message,
    COALESCE(NEW.message_type, 'text'),
    COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('legacy_tm_id', NEW.id),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tm_mirror_insert ON public.transaction_messages;
CREATE TRIGGER trg_tm_mirror_insert
AFTER INSERT ON public.transaction_messages
FOR EACH ROW
EXECUTE FUNCTION public.mirror_transaction_message_to_messages();

-- 2) Create function + trigger for transaction_messages deletes
CREATE OR REPLACE FUNCTION public.cleanup_messages_on_transaction_message_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages m
  USING public.conversations c
  WHERE m.conversation_id = c.id
    AND c.transaction_id = OLD.transaction_id
    AND (m.metadata->>'legacy_tm_id')::uuid = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tm_mirror_delete ON public.transaction_messages;
CREATE TRIGGER trg_tm_mirror_delete
AFTER DELETE ON public.transaction_messages
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_messages_on_transaction_message_delete();

-- 3) Create function + trigger for dispute_messages inserts
CREATE OR REPLACE FUNCTION public.mirror_dispute_message_to_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  -- Ensure a conversation exists for this dispute
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE dispute_id = NEW.dispute_id
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (dispute_id, seller_id, buyer_id, status)
    SELECT d.id, t.user_id, t.buyer_id, 'active'
    FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.id = NEW.dispute_id
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Mirror insert into messages with legacy id and recipient in metadata
  INSERT INTO public.messages (conversation_id, sender_id, message, message_type, metadata, created_at)
  VALUES (
    v_conversation_id,
    NEW.sender_id,
    NEW.message,
    COALESCE(NEW.message_type, 'text'),
    jsonb_build_object('recipient_id', NEW.recipient_id, 'legacy_dm_id', NEW.id),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_mirror_insert ON public.dispute_messages;
CREATE TRIGGER trg_dm_mirror_insert
AFTER INSERT ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.mirror_dispute_message_to_messages();

-- 4) Create function + trigger for dispute_messages deletes
CREATE OR REPLACE FUNCTION public.cleanup_messages_on_dispute_message_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages m
  USING public.conversations c
  WHERE m.conversation_id = c.id
    AND c.dispute_id = OLD.dispute_id
    AND (m.metadata->>'legacy_dm_id')::uuid = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_mirror_delete ON public.dispute_messages;
CREATE TRIGGER trg_dm_mirror_delete
AFTER DELETE ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_messages_on_dispute_message_delete();
