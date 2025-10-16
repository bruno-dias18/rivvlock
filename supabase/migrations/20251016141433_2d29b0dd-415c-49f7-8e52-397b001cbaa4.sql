-- Backfill : créer conversations pour transactions existantes sans conversation_id
INSERT INTO conversations (seller_id, buyer_id, transaction_id, status)
SELECT 
  t.user_id as seller_id,
  t.buyer_id,
  t.id as transaction_id,
  'active' as status
FROM transactions t
WHERE t.conversation_id IS NULL
  AND t.buyer_id IS NOT NULL
  AND t.status IN ('pending', 'paid')
ON CONFLICT DO NOTHING;

-- Mettre à jour les transactions avec leur conversation_id
UPDATE transactions t
SET conversation_id = c.id
FROM conversations c
WHERE c.transaction_id = t.id
  AND t.conversation_id IS NULL;