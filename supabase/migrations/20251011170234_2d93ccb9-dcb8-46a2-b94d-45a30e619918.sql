-- Add foreign key relationship between disputes and transactions
-- This allows the process-dispute edge function to properly JOIN transaction data
ALTER TABLE public.disputes 
ADD CONSTRAINT disputes_transaction_id_fkey 
FOREIGN KEY (transaction_id) 
REFERENCES public.transactions(id) 
ON UPDATE CASCADE 
ON DELETE RESTRICT;

-- Add index for performance on dispute queries
CREATE INDEX idx_disputes_transaction_id 
ON public.disputes(transaction_id);