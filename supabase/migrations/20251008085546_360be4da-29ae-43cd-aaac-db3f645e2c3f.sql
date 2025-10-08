-- ========================================
-- BLOQUER ACCÈS ANONYMES - VERSION CORRIGÉE
-- Sans vérification problématique
-- ========================================

-- 1. Bloquer accès anonyme à security_audit_log
DROP POLICY IF EXISTS "security_audit_block_anon_all" ON public.security_audit_log;
CREATE POLICY "security_audit_block_anon_all"
ON public.security_audit_log
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Bloquer accès anonyme à user_roles  
DROP POLICY IF EXISTS "user_roles_block_anon_all" ON public.user_roles;
CREATE POLICY "user_roles_block_anon_all"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 3. Bloquer accès anonyme à stripe_account_access_audit
DROP POLICY IF EXISTS "stripe_account_access_block_anon_all" ON public.stripe_account_access_audit;
CREATE POLICY "stripe_account_access_block_anon_all"
ON public.stripe_account_access_audit
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 4. Bloquer accès anonyme à admin_roles
DROP POLICY IF EXISTS "admin_roles_block_anon_all" ON public.admin_roles;
CREATE POLICY "admin_roles_block_anon_all"
ON public.admin_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 5. Bloquer accès anonyme à admin_role_audit_log
DROP POLICY IF EXISTS "admin_audit_block_anon_all" ON public.admin_role_audit_log;
CREATE POLICY "admin_audit_block_anon_all"
ON public.admin_role_audit_log
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 6. CORRIGER la policy INSERT trop permissive sur security_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_log;

-- Seuls les triggers/fonctions peuvent insérer (via SECURITY DEFINER)
CREATE POLICY "security_audit_trigger_insert"
ON public.security_audit_log
FOR INSERT
WITH CHECK (false);  -- Personne ne peut insérer directement, seulement via triggers

-- Les inserts se feront via la fonction log_sensitive_access() qui est SECURITY DEFINER

COMMENT ON POLICY "security_audit_block_anon_all" ON public.security_audit_log IS 
'SECURITY CRITICAL: Block all anonymous access';

COMMENT ON POLICY "security_audit_trigger_insert" ON public.security_audit_log IS 
'SECURITY CRITICAL: Only SECURITY DEFINER functions can insert audit logs';