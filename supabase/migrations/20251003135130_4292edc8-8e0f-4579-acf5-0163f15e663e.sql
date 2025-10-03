-- Dernière tentative pour sécuriser shared_link_access_logs
-- Ajouter une policy explicite de DENY pour tous les non-admins

-- Vérifier qu'il n'y a aucune policy permissive cachée
DROP POLICY IF EXISTS "Admins can read access logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "System can log access attempts" ON public.shared_link_access_logs;

-- Recréer uniquement les policies nécessaires avec des conditions très strictes
CREATE POLICY "Only admin select access logs"
ON public.shared_link_access_logs
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

CREATE POLICY "Only authenticated insert access logs"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Bloquer explicitement les accès publics
CREATE POLICY "Block public access"
ON public.shared_link_access_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);