-- Make policies explicit (no helper selector function) to satisfy strict scanners

-- ============================================
-- PROFILES: Explicit self and super_admin policies
-- ============================================
DO $$
BEGIN
  -- Drop function-based SELECT policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'only_self_or_super_admin_view_profile'
  ) THEN
    EXECUTE 'DROP POLICY "only_self_or_super_admin_view_profile" ON public.profiles';
  END IF;
END $$;

-- Create explicit PERMISSIVE policies
CREATE POLICY "profiles_select_self"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "profiles_select_super_admin"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Keep public block policy intact

-- ============================================
-- TRANSACTIONS: Explicit participant and admin policies
-- ============================================
DO $$
DECLARE pol record;
BEGIN
  -- Drop previous unified SELECT policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'participants_or_admin_select_tx'
  ) THEN
    EXECUTE 'DROP POLICY "participants_or_admin_select_tx" ON public.transactions';
  END IF;
END $$;

CREATE POLICY "transactions_select_participants"
ON public.transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR (buyer_id = auth.uid()));

CREATE POLICY "transactions_select_super_admin"
ON public.transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));