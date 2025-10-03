-- Final hardening for shared_link_access_logs (fix syntax)
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "Block public SELECT shared logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block public ALL shared logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Admins view access logs strict" ON public.shared_link_access_logs;

-- Explicitly deny any public access
CREATE POLICY "Block public SELECT shared logs"
ON public.shared_link_access_logs
FOR SELECT
TO public
USING (false);

CREATE POLICY "Block public ALL shared logs"
ON public.shared_link_access_logs
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Ensure admin-only read remains
CREATE POLICY "Admins view access logs strict"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));