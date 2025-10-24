-- Add index for problematic transactions pagination
-- Optimizes query: status='paid' AND buyer_id IS NULL

-- Partial index for problematic transactions (paid without buyer)
CREATE INDEX IF NOT EXISTS idx_transactions_problematic 
ON public.transactions(created_at DESC)
WHERE status = 'paid' AND buyer_id IS NULL;

COMMENT ON INDEX idx_transactions_problematic IS 'Optimizes queries for problematic transactions (paid without buyer)';