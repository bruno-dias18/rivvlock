-- Trigger to prevent public messages after dispute escalation
CREATE OR REPLACE FUNCTION public.prevent_public_messages_after_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute record;
  v_is_escalated boolean := false;
BEGIN
  -- Get dispute info
  SELECT * INTO v_dispute
  FROM public.disputes
  WHERE id = NEW.dispute_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Check if dispute is escalated
  v_is_escalated := (
    v_dispute.status = 'escalated' OR
    v_dispute.escalated_at IS NOT NULL OR
    (v_dispute.dispute_deadline IS NOT NULL AND v_dispute.dispute_deadline < now())
  );
  
  -- If escalated, only allow admin-related message types
  IF v_is_escalated THEN
    IF NEW.message_type NOT IN ('seller_to_admin', 'buyer_to_admin', 'admin_to_seller', 'admin_to_buyer') THEN
      RAISE EXCEPTION 'Public two-party messages are disabled after escalation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS check_escalated_message_type ON public.dispute_messages;
CREATE TRIGGER check_escalated_message_type
  BEFORE INSERT ON public.dispute_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_public_messages_after_escalation();