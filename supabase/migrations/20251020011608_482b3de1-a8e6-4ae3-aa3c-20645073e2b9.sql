-- Corriger l'erreur de sécurité Security Definer View
-- La vue dispute_migration_status existe déjà et doit être supprimée ou modifiée

-- Supprimer l'ancienne vue si elle existe
DROP VIEW IF EXISTS public.dispute_migration_status CASCADE;

-- Recréer dispute_system_health comme vue normale (sans SECURITY DEFINER)
DROP VIEW IF EXISTS public.dispute_system_health CASCADE;

CREATE VIEW public.dispute_system_health 
WITH (security_invoker = true)
AS
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