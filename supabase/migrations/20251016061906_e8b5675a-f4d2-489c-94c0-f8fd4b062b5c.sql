-- Add items column to transactions table for detailed line items
ALTER TABLE public.transactions 
ADD COLUMN items jsonb DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN public.transactions.items IS 'Optional array of line items with description, quantity, unit_price, and total. Used when transaction is in detailed mode instead of a single price.';