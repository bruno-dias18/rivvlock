-- Add refund_percentage column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS refund_percentage integer DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.transactions.refund_percentage IS 'Percentage of refund applied (0-100) for partial refunds';