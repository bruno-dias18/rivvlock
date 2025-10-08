-- ========================================
-- CORRECTION FINALE profiles
-- Changer PERMISSIVE → RESTRICTIVE
-- ========================================

-- Supprimer la policy PERMISSIVE incorrecte
DROP POLICY IF EXISTS "profiles_deny_anonymous_all" ON public.profiles;

-- Créer la policy RESTRICTIVE correcte
CREATE POLICY "profiles_deny_anonymous_all"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Vérification finale de toutes les policies RESTRICTIVE
DO $$
DECLARE
  v_restrictive_count integer;
  v_table record;
BEGIN
  RAISE NOTICE '=== FINAL SECURITY CHECK ===';
  
  FOR v_table IN
    SELECT 
      tablename,
      COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE') as restrictive_count,
      COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE' AND (policyname ILIKE '%anon%' OR policyname ILIKE '%anonymous%')) as permissive_anon_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'transactions', 'stripe_accounts', 'disputes', 'dispute_messages', 'transaction_messages')
    GROUP BY tablename
  LOOP
    IF v_table.restrictive_count = 0 THEN
      RAISE WARNING 'Table % has NO RESTRICTIVE policies!', v_table.tablename;
    ELSE
      RAISE NOTICE 'Table %: ✓ % RESTRICTIVE policies', v_table.tablename, v_table.restrictive_count;
    END IF;
    
    IF v_table.permissive_anon_count > 0 THEN
      RAISE WARNING 'Table % has % PERMISSIVE anonymous policies (should be RESTRICTIVE)', 
        v_table.tablename, v_table.permissive_anon_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== END CHECK ===';
END $$;

COMMENT ON POLICY "profiles_deny_anonymous_all" ON public.profiles IS 
'SECURITY CRITICAL: RESTRICTIVE policy blocking ALL anonymous access to sensitive personal data';