-- Add index for quotes pagination performance
-- Optimizes queries filtering by seller_id/client_user_id + archived status + ordering

-- Index for sent quotes (seller_id + archived + created_at)
CREATE INDEX IF NOT EXISTS idx_quotes_seller_archived_created 
ON public.quotes(seller_id, archived_by_seller, created_at DESC)
WHERE archived_by_seller = false;

-- Index for received quotes (client_user_id + archived + created_at)
CREATE INDEX IF NOT EXISTS idx_quotes_client_archived_created 
ON public.quotes(client_user_id, archived_by_client, created_at DESC)
WHERE archived_by_client = false AND client_user_id IS NOT NULL;

-- Index for valid_until sorting
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until 
ON public.quotes(valid_until DESC);

COMMENT ON INDEX idx_quotes_seller_archived_created IS 'Optimizes pagination for seller sent quotes';
COMMENT ON INDEX idx_quotes_client_archived_created IS 'Optimizes pagination for client received quotes';
COMMENT ON INDEX idx_quotes_valid_until IS 'Optimizes sorting by expiration date';