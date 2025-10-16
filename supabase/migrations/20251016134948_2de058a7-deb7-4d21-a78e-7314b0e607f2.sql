
-- Nettoyage complet des anciennes tables de messagerie
-- Suppression des données de test uniquement

-- Supprimer les messages de dispute non-admin (garder admin pour système escaladé)
DELETE FROM dispute_messages 
WHERE message_type NOT IN ('seller_to_admin', 'buyer_to_admin', 'admin_to_seller', 'admin_to_buyer');

-- Supprimer toutes les données de test des anciennes tables
DELETE FROM quote_messages;
DELETE FROM transaction_messages;
DELETE FROM message_reads;
DELETE FROM dispute_message_reads;

-- Note: On garde la table dispute_messages pour le système escaladé (AdminDisputeMessaging)
