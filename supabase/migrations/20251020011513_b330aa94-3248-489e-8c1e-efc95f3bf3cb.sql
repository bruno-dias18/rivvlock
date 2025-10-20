-- Corriger le warning de sécurité sur la vue
DROP VIEW IF EXISTS public.dispute_system_health;

-- Recréer la vue sans SECURITY DEFINER (vue normale)
CREATE VIEW public.dispute_system_health AS
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