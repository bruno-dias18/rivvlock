-- Permettre aux utilisateurs de voir les logs d'accès à leur propre profil
CREATE POLICY "Users can view access logs for their own profile"
ON public.profile_access_logs
FOR SELECT
TO authenticated
USING (auth.uid() = accessed_profile_id);