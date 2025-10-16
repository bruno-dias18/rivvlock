-- Add reminder_checkpoints column to track sent reminders
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reminder_checkpoints jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.transactions.reminder_checkpoints IS 'Tracks which reminder windows have been sent (e.g., {"72h": true, "48h": true})';
