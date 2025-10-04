-- Add seller validation deadline to transactions table
ALTER TABLE public.transactions 
ADD COLUMN seller_validation_deadline TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN public.transactions.seller_validation_deadline IS 'Deadline for seller to validate service delivery (48h after service date). If expired, buyer validation countdown activates automatically.';