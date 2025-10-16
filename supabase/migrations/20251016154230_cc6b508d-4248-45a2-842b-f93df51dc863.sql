
-- Étendre la contrainte message_type pour supporter TOUS les types existants et futurs

-- Supprimer l'ancienne contrainte
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Ajouter une contrainte plus permissive (accepte text non vide)
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IS NOT NULL AND length(message_type) > 0);

-- Maintenant réessayer la migration des données

-- Étape 1: Migrer transaction_messages vers le système unifié
INSERT INTO public.conversations (transaction_id, seller_id, buyer_id, status, created_at, updated_at)
SELECT DISTINCT 
  t.id as transaction_id,
  t.user_id as seller_id,
  t.buyer_id,
  'active'::text as status,
  MIN(tm.created_at) as created_at,
  MAX(tm.created_at) as updated_at
FROM public.transactions t
INNER JOIN public.transaction_messages tm ON tm.transaction_id = t.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversations c 
  WHERE c.transaction_id = t.id
)
GROUP BY t.id, t.user_id, t.buyer_id;

INSERT INTO public.messages (conversation_id, sender_id, message, message_type, metadata, created_at)
SELECT 
  c.id as conversation_id,
  tm.sender_id,
  tm.message,
  tm.message_type,
  COALESCE(tm.metadata, '{}'::jsonb) as metadata,
  tm.created_at
FROM public.transaction_messages tm
INNER JOIN public.conversations c ON c.transaction_id = tm.transaction_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages m 
  WHERE m.conversation_id = c.id 
  AND m.sender_id = tm.sender_id 
  AND m.created_at = tm.created_at
);

-- Étape 2: Migrer dispute_messages vers le système unifié
INSERT INTO public.conversations (dispute_id, seller_id, buyer_id, status, created_at, updated_at)
SELECT DISTINCT 
  d.id as dispute_id,
  t.user_id as seller_id,
  t.buyer_id,
  'active'::text as status,
  MIN(dm.created_at) as created_at,
  MAX(dm.created_at) as updated_at
FROM public.disputes d
INNER JOIN public.transactions t ON t.id = d.transaction_id
INNER JOIN public.dispute_messages dm ON dm.dispute_id = d.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversations c 
  WHERE c.dispute_id = d.id
)
GROUP BY d.id, t.user_id, t.buyer_id;

INSERT INTO public.messages (conversation_id, sender_id, message, message_type, metadata, created_at)
SELECT 
  c.id as conversation_id,
  dm.sender_id,
  dm.message,
  dm.message_type,
  jsonb_build_object(
    'recipient_id', dm.recipient_id,
    'migrated_from', 'dispute_messages'
  ) as metadata,
  dm.created_at
FROM public.dispute_messages dm
INNER JOIN public.conversations c ON c.dispute_id = dm.dispute_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages m 
  WHERE m.conversation_id = c.id 
  AND m.sender_id = dm.sender_id 
  AND m.created_at = dm.created_at
);
