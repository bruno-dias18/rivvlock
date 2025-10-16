-- Add client_email column for automated emails
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Add last_reminder_sent_at column to prevent duplicate reminders
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Create index for optimizing cron job queries
CREATE INDEX IF NOT EXISTS idx_transactions_payment_deadline_pending 
ON transactions(payment_deadline) 
WHERE status = 'pending' AND client_email IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN transactions.client_email IS 'Optional client email for automatic invitation and reminders';
COMMENT ON COLUMN transactions.last_reminder_sent_at IS 'Timestamp of last reminder email sent to prevent duplicates';