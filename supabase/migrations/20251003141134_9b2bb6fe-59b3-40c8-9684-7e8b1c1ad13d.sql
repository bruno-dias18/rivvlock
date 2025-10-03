-- Force RLS on activity_logs and transaction_access_attempts

-- 1) Force RLS on activity_logs (already enabled, but ensure FORCE)
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;

-- 2) Enable and Force RLS on transaction_access_attempts
ALTER TABLE public.transaction_access_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_access_attempts FORCE ROW LEVEL SECURITY;

-- 3) Add block anonymous policy for transaction_access_attempts
DROP POLICY IF EXISTS "Block anonymous access to access attempts" ON public.transaction_access_attempts;
CREATE POLICY "Block anonymous access to access attempts"
ON public.transaction_access_attempts
FOR ALL
USING (false)
WITH CHECK (false);

-- 4) Ensure SELECT is restricted to authenticated admins
DROP POLICY IF EXISTS "Only admins can select access attempts" ON public.transaction_access_attempts;
CREATE POLICY "Only admins can select access attempts"
ON public.transaction_access_attempts
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- 5) Keep INSERT blocked (existing policy already does this)
-- The "No direct inserts allowed" policy already exists and blocks all inserts