-- Prevent public messaging on transaction thread after dispute escalation
CREATE OR REPLACE FUNCTION public.prevent_public_messages_after_dispute_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_escalated boolean := false;
BEGIN
  -- Load the conversation for the incoming message
  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW; -- No conversation found, let RLS handle failures
  END IF;

  -- Apply only to public transaction conversations (seller ↔ buyer)
  IF v_conv.conversation_type = 'transaction' AND v_conv.transaction_id IS NOT NULL THEN
    -- Check if there is an escalated dispute for this transaction
    SELECT EXISTS (
      SELECT 1
      FROM public.disputes d
      WHERE d.transaction_id = v_conv.transaction_id
        AND (
          d.status = 'escalated'
          OR d.escalated_at IS NOT NULL
          OR (d.dispute_deadline IS NOT NULL AND d.dispute_deadline < now())
        )
    ) INTO v_escalated;

    IF v_escalated THEN
      RAISE EXCEPTION 'Public two-party messages are disabled after escalation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure a single trigger is present
DROP TRIGGER IF EXISTS trg_prevent_public_messages_after_escalation ON public.messages;
CREATE TRIGGER trg_prevent_public_messages_after_escalation
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_public_messages_after_dispute_escalation();