-- Add renewal_count column to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0 NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.transactions.renewal_count IS 'Number of times the expired transaction has been renewed by the seller';

-- Add index for better performance when querying expired transactions with renewals
CREATE INDEX IF NOT EXISTS idx_transactions_status_renewal 
ON public.transactions(status, renewal_count) 
WHERE status = 'expired';