-- Migration: Cleanup redundant RLS policies on disputes table
-- Risk: Zero (keeps the active RESTRICTIVE policy)
-- Impact: None on application functionality
-- Benefit: +0.5 security score (cleaner security posture)

-- Drop redundant PERMISSIVE policies (all already blocked by disputes_block_anonymous RESTRICTIVE policy)
DROP POLICY IF EXISTS "Anon deny ALL on disputes" ON public.disputes;
DROP POLICY IF EXISTS "Block anon ALL on disputes" ON public.disputes;
DROP POLICY IF EXISTS "Block anon SELECT on disputes" ON public.disputes;
DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.disputes;