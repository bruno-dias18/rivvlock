-- Create trigger to validate dispute message recipients (retry without comments to avoid deadlock)
DROP TRIGGER IF EXISTS validate_dispute_message_recipient_trigger ON public.dispute_messages;

CREATE TRIGGER validate_dispute_message_recipient_trigger
  BEFORE INSERT OR UPDATE ON public.dispute_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dispute_message_recipient();