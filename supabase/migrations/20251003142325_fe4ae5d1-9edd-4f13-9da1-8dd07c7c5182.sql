-- Lock down shared_link_access_logs strictly
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- Recreate explicit policies for clarity
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

-- Keep INSERT allowed only for authenticated (already enforced via WITH CHECK true).
-- No additional changes to avoid altering behavior.