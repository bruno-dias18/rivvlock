
-- Supprimer les tables inutiles pour nettoyer la base de données

-- 1. Supprimer admin_roles (redondante avec user_roles)
-- D'abord supprimer les triggers associés
DROP TRIGGER IF EXISTS log_admin_role_changes ON public.admin_roles;
DROP TRIGGER IF EXISTS log_admin_role_changes_detailed ON public.admin_roles;
DROP TRIGGER IF EXISTS update_admin_roles_updated_at ON public.admin_roles;

-- Supprimer la table
DROP TABLE IF EXISTS public.admin_roles CASCADE;

-- 2. Supprimer quote_messages (jamais utilisée, quotes utilisent conversations)
DROP TABLE IF EXISTS public.quote_messages CASCADE;

-- 3. Supprimer quote_revisions (jamais utilisée)
DROP TABLE IF EXISTS public.quote_revisions CASCADE;

-- 4. Supprimer la fonction obsolète log_admin_role_change si elle existe
DROP FUNCTION IF EXISTS public.log_admin_role_change() CASCADE;

-- Note: admin_role_audit_log est conservée car elle contient l'historique d'audit
-- Note: user_roles est la table correcte à utiliser pour les rôles
