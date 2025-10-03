-- Strengthen recipient validation for dispute messages
-- 1) Enforce at write-time via trigger
CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow broadcast/system messages explicitly (no recipient)
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure recipient is a legitimate participant in the dispute
  PERFORM 1
  FROM public.disputes d
  JOIN public.transactions t ON t.id = d.transaction_id
  WHERE d.id = NEW.dispute_id
    AND (
      NEW.recipient_id = d.reporter_id OR
      NEW.recipient_id = t.user_id OR
      NEW.recipient_id = t.buyer_id
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid recipient for this dispute message';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_dispute_message_recipient ON public.dispute_messages;
CREATE TRIGGER trg_validate_dispute_message_recipient
BEFORE INSERT ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_dispute_message_recipient();

-- 2) Tighten RLS INSERT policy to also validate recipient_id
DROP POLICY IF EXISTS "Users can create messages in their disputes" ON public.dispute_messages;
CREATE POLICY "Users can create messages in their disputes"
ON public.dispute_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.id = dispute_messages.dispute_id
      AND (
        d.reporter_id = auth.uid() OR
        t.user_id = auth.uid() OR
        t.buyer_id = auth.uid()
      )
  )
  AND (
    recipient_id IS NULL OR EXISTS (
      SELECT 1 FROM public.disputes d2
      JOIN public.transactions t2 ON t2.id = d2.transaction_id
      WHERE d2.id = dispute_messages.dispute_id
        AND (
          recipient_id = d2.reporter_id OR
          recipient_id = t2.user_id OR
          recipient_id = t2.buyer_id
        )
    )
  )
);
