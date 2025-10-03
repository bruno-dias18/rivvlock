-- Secure transaction_access_attempts: enable RLS and lock down reads

-- 1) Ensure Row Level Security is enabled
ALTER TABLE public.transaction_access_attempts ENABLE ROW LEVEL SECURITY;

-- 2) Revoke any direct SELECT privileges from anon/authenticated roles
REVOKE SELECT ON public.transaction_access_attempts FROM anon, authenticated;

-- 3) Create (or replace) a strict SELECT policy for admins only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'transaction_access_attempts' 
      AND policyname = 'Only admins can select access attempts'
  ) THEN
    EXECUTE 'DROP POLICY "Only admins can select access attempts" ON public.transaction_access_attempts';
  END IF;
END $$;

CREATE POLICY "Only admins can select access attempts"
ON public.transaction_access_attempts
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- NOTE: We intentionally DO NOT create an INSERT policy.
-- Edge Functions use the service role which bypasses RLS for inserts
-- via the SECURITY DEFINER function public.log_transaction_access.
-- This prevents any direct client-side inserts while keeping server logging intact.
