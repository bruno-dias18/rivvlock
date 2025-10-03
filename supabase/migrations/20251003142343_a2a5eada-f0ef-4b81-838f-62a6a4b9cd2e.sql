-- Harden shared_link_access_logs RLS (correct INSERT policy)
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- Block anonymous explicitly
DROP POLICY IF EXISTS "Block anonymous access to shared link logs" ON public.shared_link_access_logs;
CREATE POLICY "Block anonymous access to shared link logs"
ON public.shared_link_access_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Restrict SELECT to authenticated admins only
DROP POLICY IF EXISTS "Admins can select access logs" ON public.shared_link_access_logs;
CREATE POLICY "Admins can select access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- Allow authenticated insert (for audit logging by edge functions)
DROP POLICY IF EXISTS "Secure authenticated insert only" ON public.shared_link_access_logs;
CREATE POLICY "Authenticated can insert shared link logs"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);