-- Remove unsafe view flagged by security scan (no RLS on views)
DROP VIEW IF EXISTS public.safe_profiles;