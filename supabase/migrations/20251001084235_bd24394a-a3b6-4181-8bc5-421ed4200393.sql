-- Optimisation des requêtes de messages transactionnels
-- Créer un index sur (transaction_id, created_at DESC) pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS idx_transaction_messages_txid_created 
ON public.transaction_messages (transaction_id, created_at DESC);

-- Commentaire pour expliquer l'index
COMMENT ON INDEX idx_transaction_messages_txid_created IS 'Accélère les requêtes de messages par transaction triés par date';