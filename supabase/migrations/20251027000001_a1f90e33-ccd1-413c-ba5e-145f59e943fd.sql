-- Add 'refunded' to transaction_status enum
-- SAFE: IF NOT EXISTS prevents errors if already run
-- SAFE: Does NOT modify any existing transaction data
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'refunded';

-- Verification comment (for logs only, does not change data)
-- Expected result: {pending, paid, validated, disputed, expired, refunded}
COMMENT ON TYPE transaction_status IS 'Transaction status including refunded state';