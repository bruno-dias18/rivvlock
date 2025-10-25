-- Performance Optimization: Critical Database Indexes
-- These indexes dramatically improve query performance for dashboard and messaging
-- ZERO regression risk: indexes only improve read performance, no logic changes

-- 1. Transactions by user and status (Dashboard main queries)
CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
ON transactions(user_id, status) 
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_buyer_status 
ON transactions(buyer_id, status) 
WHERE buyer_id IS NOT NULL AND status IS NOT NULL;

-- 2. Transactions by updated_at (for recent activity sorting)
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at 
ON transactions(updated_at DESC);

-- 3. Messages by conversation (Real-time chat queries)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- 4. Disputes by transaction and status (Dispute resolution queries)
CREATE INDEX IF NOT EXISTS idx_disputes_transaction_status 
ON disputes(transaction_id, status);

-- 5. Conversations by participants (Unread count queries)
CREATE INDEX IF NOT EXISTS idx_conversations_seller 
ON conversations(seller_id) 
WHERE seller_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_buyer 
ON conversations(buyer_id) 
WHERE buyer_id IS NOT NULL;

-- 6. Conversation reads for unread count optimization
CREATE INDEX IF NOT EXISTS idx_conversation_reads_user_updated 
ON conversation_reads(user_id, updated_at DESC);

-- 7. Quotes by seller and status
CREATE INDEX IF NOT EXISTS idx_quotes_seller_status 
ON quotes(seller_id, status);

-- 8. Activity logs by user and timestamp (Activity history page)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created 
ON activity_logs(user_id, created_at DESC);

COMMENT ON INDEX idx_transactions_user_status IS 'Optimizes dashboard queries for seller transactions';
COMMENT ON INDEX idx_transactions_buyer_status IS 'Optimizes dashboard queries for buyer transactions';
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimizes real-time chat message loading';
COMMENT ON INDEX idx_disputes_transaction_status IS 'Optimizes dispute resolution queries';
