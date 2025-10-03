-- ============================================================================
-- SUPPRESSION VUE LEGACY user_disputes
-- ============================================================================
-- Cette vue n'est jamais utilisée dans le code et cause un warning
-- MISSING_RLS_PROTECTION (impossible d'activer RLS sur une VIEW)
-- ============================================================================

-- Supprimer la vue user_disputes (legacy, non utilisée)
DROP VIEW IF EXISTS public.user_disputes CASCADE;