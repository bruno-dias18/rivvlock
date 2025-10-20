-- ============================================================
-- NETTOYAGE ARCHITECTURE DISPUTES V3 - SUPPRESSION COMPLÈTE DES TRIGGERS
-- ============================================================

-- 1. Supprimer complètement les triggers et fonctions de validation
DROP TRIGGER IF EXISTS trg_validate_dispute_conversation ON public.conversations;
DROP FUNCTION IF EXISTS public.validate_dispute_conversation() CASCADE;

-- 2. Supprimer l'historique - CONVERSATIONS D'ABORD (avant disputes)
DELETE FROM public.message_reads
WHERE message_id IN (
  SELECT m.id FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute')
);

DELETE FROM public.messages 
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute')
);

DELETE FROM public.conversation_reads
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute')
);

DELETE FROM public.conversations 
WHERE conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute');

-- 3. Maintenant supprimer les disputes et leurs propositions
DELETE FROM public.dispute_proposals;
DELETE FROM public.admin_dispute_notes;
DELETE FROM public.disputes;

-- 4. Recréer la fonction de validation pour conversations
CREATE OR REPLACE FUNCTION public.validate_dispute_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si conversation_type est dispute-related, dispute_id doit être set
  IF NEW.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute', 'dispute') THEN
    IF NEW.dispute_id IS NULL THEN
      RAISE EXCEPTION 'dispute_id is required for dispute conversations';
    END IF;
    
    -- Vérifier que le dispute existe
    IF NOT EXISTS (
      SELECT 1 FROM public.disputes d WHERE d.id = NEW.dispute_id
    ) THEN
      RAISE EXCEPTION 'Invalid dispute_id reference';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Recréer le trigger
CREATE TRIGGER trg_validate_dispute_conversation
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dispute_conversation();

-- 6. Forcer conversation_id NOT NULL sur disputes
ALTER TABLE public.disputes 
ALTER COLUMN conversation_id SET NOT NULL;

-- 7. Créer fonction de validation pour nouveaux disputes
CREATE OR REPLACE FUNCTION public.validate_new_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Forcer que tout nouveau dispute ait une conversation
  IF NEW.conversation_id IS NULL THEN
    RAISE EXCEPTION 'Nouveau dispute doit avoir un conversation_id (système unifié obligatoire)';
  END IF;
  
  -- Forcer que la conversation existe
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = NEW.conversation_id
  ) THEN
    RAISE EXCEPTION 'conversation_id invalide pour le nouveau dispute';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Créer trigger pour validation disputes
DROP TRIGGER IF EXISTS trg_validate_new_dispute ON public.disputes;
CREATE TRIGGER trg_validate_new_dispute
  BEFORE INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_new_dispute();

-- 9. Nettoyer anciennes fonctions de réparation
DROP FUNCTION IF EXISTS public.repair_orphan_disputes() CASCADE;
DROP TRIGGER IF EXISTS trg_sync_dispute_to_conversation ON public.disputes;
DROP TRIGGER IF EXISTS trg_sync_conversation_to_dispute ON public.conversations;
DROP FUNCTION IF EXISTS public.sync_dispute_to_conversation() CASCADE;
DROP FUNCTION IF EXISTS public.sync_conversation_to_dispute() CASCADE;
DROP FUNCTION IF EXISTS public.sync_dispute_conversation_complete() CASCADE;

-- 10. Documentation
COMMENT ON TABLE public.disputes IS 
'✅ SYSTÈME UNIFIÉ - Tous les disputes doivent avoir un conversation_id';

COMMENT ON COLUMN public.disputes.conversation_id IS 
'✅ OBLIGATOIRE - Conversation unifiée du dispute';

-- 11. Vue de santé du système
CREATE OR REPLACE VIEW public.dispute_system_health AS
SELECT 
  'Total disputes' as metric,
  COUNT(*)::text as count
FROM public.disputes
UNION ALL
SELECT 
  'Disputes avec conversation' as metric,
  COUNT(*)::text as count  
FROM public.disputes WHERE conversation_id IS NOT NULL
UNION ALL
SELECT 
  'Conversations de disputes' as metric,
  COUNT(*)::text as count
FROM public.conversations 
WHERE conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute');

-- ✅ Nettoyage terminé - Système unifié seul actif