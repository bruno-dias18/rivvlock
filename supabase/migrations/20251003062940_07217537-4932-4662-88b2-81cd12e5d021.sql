-- ============================================================================
-- CORRECTION FINALE DES ERREURS DE SÉCURITÉ CRITIQUES
-- ============================================================================
-- Suppression de la vue shared_transactions (cause MISSING_RLS_PROTECTION)
-- ============================================================================

-- Supprimer la vue shared_transactions (impossible d'activer RLS sur une VIEW)
DROP VIEW IF EXISTS public.shared_transactions CASCADE;