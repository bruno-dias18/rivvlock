-- Final hardening for shared_link_access_logs (no IF NOT EXISTS in policy syntax)
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_link_access_logs FORCE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're exactly right
DROP POLICY IF EXISTS "Block public SELECT on access logs v2" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block public ALL on access logs v2" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Admins can view access logs (strict)" ON public.shared_link_access_logs;

-- Explicitly deny any public role access
CREATE POLICY "Block public SELECT on access logs v2"
ON public.shared_link_access_logs
FOR SELECT
TO public
USING (false);

CREATE POLICY "Block public ALL on access logs v2"
ON public.shared_link_access_logs
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Admin-only read
CREATE POLICY "Admins can view access logs (strict)"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));