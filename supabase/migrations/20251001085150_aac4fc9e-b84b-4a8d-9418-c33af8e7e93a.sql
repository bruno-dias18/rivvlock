-- Supprimer la table transaction_messages et son index
DROP INDEX IF EXISTS idx_transaction_messages_txid_created;
DROP TABLE IF EXISTS public.transaction_messages;