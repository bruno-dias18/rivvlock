-- Add individual archiving fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS archived_by_seller boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_by_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS seller_archived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS client_archived_at timestamp with time zone;

-- Add index for better performance on archived queries
CREATE INDEX IF NOT EXISTS idx_quotes_archived_by_seller ON public.quotes(archived_by_seller) WHERE archived_by_seller = false;
CREATE INDEX IF NOT EXISTS idx_quotes_archived_by_client ON public.quotes(archived_by_client) WHERE archived_by_client = false;

COMMENT ON COLUMN public.quotes.archived_by_seller IS 'Whether the seller has archived this quote from their view';
COMMENT ON COLUMN public.quotes.archived_by_client IS 'Whether the client has archived this quote from their view';
COMMENT ON COLUMN public.quotes.seller_archived_at IS 'Timestamp when seller archived the quote';
COMMENT ON COLUMN public.quotes.client_archived_at IS 'Timestamp when client archived the quote';