-- NETTOYAGE SÉCURISÉ: Supprimer les anciens litiges incompatibles
-- Approche en 3 étapes pour éviter les conflits avec les triggers

-- ÉTAPE 1: Désactiver temporairement le trigger de validation
ALTER TABLE public.conversations DISABLE TRIGGER validate_dispute_conversation_trigger;

-- ÉTAPE 2: Supprimer les litiges sans conversation_id (legacy)
-- Ces litiges sont incompatibles avec l'architecture unifiée
DELETE FROM public.disputes
WHERE conversation_id IS NULL;

-- ÉTAPE 3: Réactiver le trigger de validation
ALTER TABLE public.conversations ENABLE TRIGGER validate_dispute_conversation_trigger;

-- Vérification finale
-- SELECT 
--   COUNT(*) as total_disputes,
--   COUNT(conversation_id) as disputes_with_conversation,
--   COUNT(*) - COUNT(conversation_id) as legacy_disputes_remaining
-- FROM public.disputes;