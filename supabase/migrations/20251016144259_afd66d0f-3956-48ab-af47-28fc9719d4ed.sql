-- Étape 2: Optimisation des performances - Ajout d'index manquants

-- Index sur conversations pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_quote_id ON conversations(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_dispute_id ON conversations(dispute_id) WHERE dispute_id IS NOT NULL;

-- Index sur messages pour accélérer les recherches par conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Index sur transactions pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_transactions_conversation_id ON transactions(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_status ON transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id_status ON transactions(buyer_id, status) WHERE buyer_id IS NOT NULL;

-- Index sur dispute_messages pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id_created_at ON dispute_messages(dispute_id, created_at DESC);

-- Index sur transaction_messages pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transaction_messages_transaction_id_created_at ON transaction_messages(transaction_id, created_at DESC);