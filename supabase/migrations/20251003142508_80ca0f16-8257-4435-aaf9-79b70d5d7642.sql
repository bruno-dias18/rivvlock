-- Eliminate all non-admin access to shared_link_access_logs except system INSERT

-- 1) Drop the permissive "Secure authenticated insert only" policy
DROP POLICY IF EXISTS "Secure authenticated insert only" ON public.shared_link_access_logs;

-- 2) Allow INSERT only for the system logging function (authenticated, no user restriction)
CREATE POLICY "System can insert access logs"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3) Keep SELECT restricted to admins
-- (already done above, no change)

-- 4) Block UPDATE and DELETE entirely
CREATE POLICY "No updates allowed on access logs"
ON public.shared_link_access_logs
FOR UPDATE
USING (false);

CREATE POLICY "No deletes allowed on access logs"
ON public.shared_link_access_logs
FOR DELETE
USING (false);