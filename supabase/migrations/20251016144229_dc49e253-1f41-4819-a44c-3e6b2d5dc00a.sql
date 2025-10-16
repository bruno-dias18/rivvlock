-- Étape 1: Nettoyage des conversations en double
-- Identifier et supprimer les conversations dupliquées par transaction_id (garder la plus ancienne)

-- Supprimer les conversations en double (garder celle avec le plus petit created_at)
DELETE FROM conversations c1
WHERE EXISTS (
  SELECT 1 FROM conversations c2
  WHERE c2.transaction_id = c1.transaction_id
    AND c2.transaction_id IS NOT NULL
    AND c2.created_at < c1.created_at
);

-- Resynchroniser les transactions.conversation_id vers la bonne conversation
UPDATE transactions t
SET conversation_id = (
  SELECT c.id 
  FROM conversations c 
  WHERE c.transaction_id = t.id 
  ORDER BY c.created_at ASC 
  LIMIT 1
)
WHERE t.conversation_id IS NULL
  AND EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.transaction_id = t.id
  );

-- Vérification: s'assurer qu'il n'y a qu'une seule conversation par transaction
-- Cette contrainte empêchera les futurs doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_transaction_id_unique 
ON conversations(transaction_id) 
WHERE transaction_id IS NOT NULL;