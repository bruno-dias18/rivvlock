-- ========================================
-- DERNIÈRE CORRECTION - security_audit_log
-- Ajouter policy RESTRICTIVE pour bloquer anon
-- ========================================

-- Créer policy RESTRICTIVE pour security_audit_log
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'security_audit_log' 
      AND policyname = 'security_audit_block_anon_all'
  ) THEN
    EXECUTE 'CREATE POLICY "security_audit_block_anon_all" ON public.security_audit_log AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;
END $$;

COMMENT ON POLICY "security_audit_block_anon_all" ON public.security_audit_log IS 
'SECURITY CRITICAL: RESTRICTIVE policy blocking ALL anonymous access to audit logs';

-- Rapport final de sécurité
DO $$
DECLARE
  v_table record;
  v_total_restrictive integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════╗';
  RAISE NOTICE '║        RAPPORT DE SÉCURITÉ FINAL - RIVVLOCK          ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  FOR v_table IN
    SELECT 
      t.tablename,
      bool_and(t.rowsecurity) as rls_enabled,
      COUNT(p.policyname) as total_policies,
      COUNT(*) FILTER (WHERE p.permissive = 'RESTRICTIVE') as restrictive_count,
      COUNT(*) FILTER (WHERE p.permissive = 'RESTRICTIVE' AND p.policyname ILIKE '%anon%') as anon_restrictive
    FROM pg_tables t
    LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
    WHERE t.schemaname = 'public'
      AND t.tablename IN (
        'profiles', 'transactions', 'stripe_accounts', 
        'disputes', 'dispute_messages', 'transaction_messages',
        'user_roles', 'admin_roles', 'security_audit_log',
        'invoice_sequences', 'invoices'
      )
    GROUP BY t.tablename
    ORDER BY t.tablename
  LOOP
    v_total_restrictive := v_total_restrictive + COALESCE(v_table.restrictive_count, 0);
    
    RAISE NOTICE 'Table: % | RLS: % | Policies: % | RESTRICTIVE: % | Anon Block: %',
      RPAD(v_table.tablename, 30),
      CASE WHEN v_table.rls_enabled THEN '✓' ELSE '✗' END,
      LPAD(v_table.total_policies::text, 2),
      LPAD(COALESCE(v_table.restrictive_count, 0)::text, 2),
      CASE WHEN COALESCE(v_table.anon_restrictive, 0) > 0 THEN '✓' ELSE '✗' END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Total RESTRICTIVE policies: %', v_total_restrictive;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Sécurité renforcée avec succès';
  RAISE NOTICE '⚠️  2 actions manuelles requises (voir instructions)';
END $$;