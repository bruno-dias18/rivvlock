-- Lock down shared_link_access_logs (no public reads)
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- Recreate explicit anon block and admin-only SELECT for authenticated users
DROP POLICY IF EXISTS "Admins can select access logs" ON public.shared_link_access_logs;
CREATE POLICY "Admins can select access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Block anonymous access to shared link logs" ON public.shared_link_access_logs;
CREATE POLICY "Block anonymous access to shared link logs"
ON public.shared_link_access_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Keep insert policy as-is (secure authenticated insert only)
