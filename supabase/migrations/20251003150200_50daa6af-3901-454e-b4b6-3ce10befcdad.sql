-- Final strict policy for shared_link_access_logs (using DO block to avoid syntax issues)
DO $$
BEGIN
  -- Remove any existing policies
  EXECUTE 'DROP POLICY IF EXISTS "Block public SELECT on access logs" ON public.shared_link_access_logs';
  EXECUTE 'DROP POLICY IF EXISTS "Block public ALL on access logs" ON public.shared_link_access_logs';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can view access logs (strict)" ON public.shared_link_access_logs';
  
  -- Add strict deny-all policy for public role
  EXECUTE 'CREATE POLICY "Block public access to logs" ON public.shared_link_access_logs FOR ALL TO public USING (false) WITH CHECK (false)';
  
  -- Add strict admin-only policy
  EXECUTE 'CREATE POLICY "Admin only log access" ON public.shared_link_access_logs FOR SELECT TO authenticated USING (check_admin_role(auth.uid()))';
END
$$;