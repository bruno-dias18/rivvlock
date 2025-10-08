-- ========================================
-- DERNIÈRE CORRECTION - security_audit_log
-- Ajouter policy RESTRICTIVE pour bloquer anonymous
-- ========================================

-- Ajouter policy RESTRICTIVE pour security_audit_log
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'security_audit_log' 
      AND policyname = 'security_audit_block_anon_all'
  ) THEN
    EXECUTE 'CREATE POLICY "security_audit_block_anon_all" ON public.security_audit_log AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
    RAISE NOTICE '✓ Created RESTRICTIVE anonymous blocking policy on security_audit_log';
  ELSE
    RAISE NOTICE '✓ Policy security_audit_block_anon_all already exists';
  END IF;
END $$;

-- Rapport final de sécurité
DO $$
DECLARE
  v_table record;
  v_total_tables integer := 0;
  v_protected_tables integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║   SECURITY AUDIT FINAL REPORT          ║';
  RAISE NOTICE '╚════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  FOR v_table IN
    SELECT 
      t.tablename,
      bool_and(t.rowsecurity) as rls_enabled,
      COUNT(p.policyname) FILTER (WHERE p.permissive = 'RESTRICTIVE') as restrictive_policies,
      COUNT(p.policyname) as total_policies
    FROM pg_tables t
    LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
    WHERE t.schemaname = 'public'
      AND t.tablename IN (
        'profiles', 'transactions', 'stripe_accounts', 
        'disputes', 'dispute_messages', 'transaction_messages',
        'user_roles', 'admin_roles', 'security_audit_log'
      )
    GROUP BY t.tablename
    ORDER BY t.tablename
  LOOP
    v_total_tables := v_total_tables + 1;
    
    IF v_table.rls_enabled AND v_table.restrictive_policies > 0 THEN
      v_protected_tables := v_protected_tables + 1;
      RAISE NOTICE '✓ % - RLS: ON | Policies: % (% RESTRICTIVE)', 
        rpad(v_table.tablename, 30),
        v_table.total_policies,
        v_table.restrictive_policies;
    ELSIF v_table.rls_enabled THEN
      RAISE WARNING '⚠ % - RLS: ON | Policies: % (NO RESTRICTIVE)', 
        rpad(v_table.tablename, 30),
        v_table.total_policies;
    ELSE
      RAISE WARNING '✗ % - RLS: OFF | CRITICAL SECURITY ISSUE', 
        rpad(v_table.tablename, 30);
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Protected tables: %/%', v_protected_tables, v_total_tables;
  RAISE NOTICE 'Security score: %/10', ROUND((v_protected_tables::numeric / v_total_tables::numeric) * 10, 1);
  RAISE NOTICE '';
END $$;

COMMENT ON POLICY "security_audit_block_anon_all" ON public.security_audit_log IS 
'SECURITY CRITICAL: RESTRICTIVE policy blocking ALL anonymous access to audit logs';