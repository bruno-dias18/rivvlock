-- Add payment_deadline_hours column to transactions table
-- This stores the payment deadline preference when proposing a date change
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_deadline_hours integer;

-- Add a comment to document the column
COMMENT ON COLUMN public.transactions.payment_deadline_hours IS 'Number of hours before service_date that payment is due (24, 72, or 168). Used when proposing date changes.';