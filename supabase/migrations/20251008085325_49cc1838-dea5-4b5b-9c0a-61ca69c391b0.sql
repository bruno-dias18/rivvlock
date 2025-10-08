-- ========================================
-- CORRECTION FAILLE CRITIQUE user_roles
-- La policy "user_roles_block_anon" autorise trop d'accès
-- ========================================

-- Supprimer la policy dangereuse
DROP POLICY IF EXISTS "user_roles_block_anon" ON public.user_roles;

-- Créer des policies restrictives par opération
CREATE POLICY "user_roles_block_insert"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "user_roles_block_update"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "user_roles_block_delete"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Vérifier qu'aucune policy ALL n'existe (sauf super_admin)
DO $$
DECLARE
  dangerous_policies record;
BEGIN
  FOR dangerous_policies IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename IN ('user_roles', 'stripe_account_access_audit', 'admin_roles')
      AND cmd = 'ALL'
      AND policyname != 'user_roles_super_admin_all'
  LOOP
    RAISE WARNING 'Dangerous ALL policy detected: %.% - Consider splitting into specific operations', 
      dangerous_policies.tablename, dangerous_policies.policyname;
  END LOOP;
END $$;

COMMENT ON POLICY "user_roles_block_insert" ON public.user_roles IS 
'SECURITY CRITICAL: Only super admins can insert user roles';

COMMENT ON POLICY "user_roles_block_update" ON public.user_roles IS 
'SECURITY CRITICAL: Only super admins can update user roles';

COMMENT ON POLICY "user_roles_block_delete" ON public.user_roles IS 
'SECURITY CRITICAL: Only super admins can delete user roles';