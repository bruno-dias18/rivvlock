-- ========================================
-- CONSOLIDATION SÉCURITÉ FINALE
-- Bloquer accès anonyme avec RESTRICTIVE policies
-- ========================================

-- 1. CRITICAL: profiles - Policy RESTRICTIVE pour bloquer anonymous
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'profiles_deny_anonymous_all'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles_deny_anonymous_all" ON public.profiles AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- 2. WARN: transactions - Consolidation (DROP si existe, puis CREATE)
DO $$
BEGIN
  -- Supprimer toutes les anciennes policies anonymes redondantes
  DROP POLICY IF EXISTS "Anon deny ALL on transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Block all anonymous access to transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Block anon ALL on transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.transactions;
  
  -- Créer UNE SEULE policy RESTRICTIVE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'transactions' 
      AND policyname = 'transactions_block_anonymous'
  ) THEN
    EXECUTE 'CREATE POLICY "transactions_block_anonymous" ON public.transactions AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- 3. WARN: stripe_accounts - Consolidation
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anon deny ALL on stripe_accounts" ON public.stripe_accounts;
  DROP POLICY IF EXISTS "Block anonymous access to stripe accounts" ON public.stripe_accounts;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'stripe_accounts' 
      AND policyname = 'stripe_accounts_block_anonymous'
  ) THEN
    EXECUTE 'CREATE POLICY "stripe_accounts_block_anonymous" ON public.stripe_accounts AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- 4. Autres tables sensibles - S'assurer qu'elles ont aussi des RESTRICTIVE policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'disputes' 
      AND policyname = 'disputes_block_anonymous'
  ) THEN
    EXECUTE 'CREATE POLICY "disputes_block_anonymous" ON public.disputes AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'dispute_messages' 
      AND policyname = 'dispute_messages_block_anonymous'
  ) THEN
    EXECUTE 'CREATE POLICY "dispute_messages_block_anonymous" ON public.dispute_messages AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'transaction_messages' 
      AND policyname = 'transaction_messages_block_anonymous'
  ) THEN
    EXECUTE 'CREATE POLICY "transaction_messages_block_anonymous" ON public.transaction_messages AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- Rapport final
DO $$
DECLARE
  table_stats record;
BEGIN
  RAISE NOTICE '=== SECURITY AUDIT REPORT ===';
  
  FOR table_stats IN
    SELECT 
      t.tablename,
      COUNT(p.policyname) as policy_count,
      bool_and(t.rowsecurity) as rls_enabled
    FROM pg_tables t
    LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
    WHERE t.schemaname = 'public'
      AND t.tablename IN (
        'profiles', 'transactions', 'stripe_accounts', 
        'disputes', 'dispute_messages', 'transaction_messages',
        'user_roles', 'security_audit_log'
      )
    GROUP BY t.tablename
    ORDER BY t.tablename
  LOOP
    RAISE NOTICE 'Table: % | RLS: % | Policies: %', 
      table_stats.tablename,
      CASE WHEN table_stats.rls_enabled THEN '✓' ELSE '✗ CRITICAL' END,
      table_stats.policy_count;
  END LOOP;
  
  RAISE NOTICE '=== END REPORT ===';
END $$;