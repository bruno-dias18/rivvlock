-- Forcer la mise à jour de la policy SELECT sur shared_link_access_logs

DROP POLICY IF EXISTS "Admins can read access logs" ON public.shared_link_access_logs;

-- Recréer avec une condition plus explicite
CREATE POLICY "Admin only SELECT access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));