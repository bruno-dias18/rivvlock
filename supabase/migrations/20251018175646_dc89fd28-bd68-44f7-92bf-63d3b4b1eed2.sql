-- Phase 5 - Step 2D: Fix Security Definer View Warning
-- Recreate the view with explicit SECURITY INVOKER

DROP VIEW IF EXISTS public.dispute_migration_status;

CREATE VIEW public.dispute_migration_status
WITH (security_invoker = true)
AS
SELECT 'Total Disputes' as metric, COUNT(*)::text as count FROM public.disputes
UNION ALL
SELECT 'Disputes with Conversations', COUNT(*)::text FROM public.disputes WHERE conversation_id IS NOT NULL
UNION ALL
SELECT 'Disputes without Conversations', COUNT(*)::text FROM public.disputes WHERE conversation_id IS NULL
UNION ALL
SELECT 'Active Disputes', COUNT(*)::text FROM public.disputes WHERE status IN ('open', 'responded', 'negotiating', 'escalated')
UNION ALL
SELECT 'Escalated Disputes', COUNT(*)::text FROM public.disputes WHERE escalated_at IS NOT NULL
UNION ALL
SELECT 'Admin Seller Conversations', COUNT(*)::text FROM public.conversations WHERE conversation_type = 'admin_seller_dispute'
UNION ALL
SELECT 'Admin Buyer Conversations', COUNT(*)::text FROM public.conversations WHERE conversation_type = 'admin_buyer_dispute';

GRANT SELECT ON public.dispute_migration_status TO authenticated;