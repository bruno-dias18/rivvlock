-- ========================================
-- CORRECTION SÉCURITÉ CRITICAL
-- Bloquer accès public aux tables sensibles
-- ========================================

-- 1. Bloquer l'accès public à stripe_account_access_audit
-- Ces données ne doivent être visibles QUE par les admins

DROP POLICY IF EXISTS "admins_can_select_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "authenticated_can_insert_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "block_anon_all_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "block_anon_select_stripe_audit" ON public.stripe_account_access_audit;
DROP POLICY IF EXISTS "force_auth_stripe_audit" ON public.stripe_account_access_audit;

-- Nouvelle policy stricte : ADMINS ONLY
CREATE POLICY "stripe_audit_admin_only_select"
ON public.stripe_account_access_audit
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "stripe_audit_system_insert"
ON public.stripe_account_access_audit
FOR INSERT
WITH CHECK (true);

CREATE POLICY "stripe_audit_block_all_updates"
ON public.stripe_account_access_audit
FOR UPDATE
USING (false);

CREATE POLICY "stripe_audit_block_all_deletes"
ON public.stripe_account_access_audit
FOR DELETE
USING (false);

-- 2. Bloquer l'accès public à user_roles
-- Les rôles ne doivent être visibles QUE par l'utilisateur concerné et les super admins

DROP POLICY IF EXISTS "block_anon_all_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "block_anon_select_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "force_auth_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admins_manage_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_read_own_roles" ON public.user_roles;

-- Nouvelles policies strictes
CREATE POLICY "user_roles_own_select"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "user_roles_super_admin_all"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "user_roles_block_anon"
ON public.user_roles
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Vérifier que toutes les tables sensibles ont RLS activée
DO $$
DECLARE
  missing_rls text[];
BEGIN
  SELECT array_agg(tablename)
  INTO missing_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'transactions', 'disputes', 'dispute_messages',
      'stripe_accounts', 'stripe_account_access_audit', 
      'user_roles', 'admin_roles', 'security_audit_log'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = pg_tables.tablename
        AND c.relrowsecurity = true
    );
  
  IF array_length(missing_rls, 1) > 0 THEN
    RAISE EXCEPTION 'RLS not enabled on: %', array_to_string(missing_rls, ', ');
  END IF;
END $$;

-- Commentaires de sécurité
COMMENT ON POLICY "stripe_audit_admin_only_select" ON public.stripe_account_access_audit IS 
'SECURITY CRITICAL: Only admins can view Stripe access audit logs';

COMMENT ON POLICY "user_roles_own_select" ON public.user_roles IS 
'SECURITY CRITICAL: Users can only see their own roles + super admins see all';

COMMENT ON POLICY "user_roles_super_admin_all" ON public.user_roles IS 
'SECURITY CRITICAL: Only super admins can manage user roles';