-- Phase 1: Rollback mirroring triggers (pas besoin de duplication)
DROP TRIGGER IF EXISTS trg_tm_mirror_insert ON public.transaction_messages;
DROP TRIGGER IF EXISTS trg_tm_mirror_delete ON public.transaction_messages;
DROP TRIGGER IF EXISTS trg_dm_mirror_insert ON public.dispute_messages;
DROP TRIGGER IF EXISTS trg_dm_mirror_delete ON public.dispute_messages;

DROP FUNCTION IF EXISTS public.mirror_transaction_message_to_messages();
DROP FUNCTION IF EXISTS public.cleanup_messages_on_transaction_message_delete();
DROP FUNCTION IF EXISTS public.mirror_dispute_message_to_messages();
DROP FUNCTION IF EXISTS public.cleanup_messages_on_dispute_message_delete();

-- Phase 2: Migrer données historiques transaction_messages → messages
INSERT INTO public.messages (conversation_id, sender_id, message, message_type, metadata, created_at)
SELECT 
  c.id as conversation_id,
  tm.sender_id,
  tm.message,
  COALESCE(tm.message_type, 'text') as message_type,
  COALESCE(tm.metadata, '{}'::jsonb) || jsonb_build_object('migrated_from_tm', true, 'original_tm_id', tm.id) as metadata,
  tm.created_at
FROM public.transaction_messages tm
JOIN public.conversations c ON c.transaction_id = tm.transaction_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages m 
  WHERE m.conversation_id = c.id 
  AND (m.metadata->>'original_tm_id')::uuid = tm.id
)
ORDER BY tm.created_at ASC;

-- Phase 3: Supprimer la table transaction_messages
DROP TABLE IF EXISTS public.transaction_messages CASCADE;