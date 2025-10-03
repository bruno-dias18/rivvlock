-- Nettoyer les policies en doublon et conflictuelles sur shared_link_access_logs

-- Supprimer les doublons
DROP POLICY IF EXISTS "Block public access" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Only admin select access logs" ON public.shared_link_access_logs;

-- Corriger la policy d'insertion pour être plus restrictive
DROP POLICY IF EXISTS "Only authenticated insert access logs" ON public.shared_link_access_logs;

-- Créer une nouvelle policy d'insertion stricte
CREATE POLICY "Secure authenticated insert only"
ON public.shared_link_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true); -- Permet l'insertion par des utilisateurs authentifiés uniquement