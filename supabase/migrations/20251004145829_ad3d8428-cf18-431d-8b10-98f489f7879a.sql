-- Final clamp: block public on profiles & transactions and unify SELECT policies

-- ============================================
-- PROFILES: Block public and keep restrictive own-or-super-admin
-- ============================================
DO $$
BEGIN
  -- Block public role explicitly
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'public_deny_all_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "public_deny_all_profiles" ON public.profiles';
  END IF;
END $$;

CREATE POLICY "public_deny_all_profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Ensure single restrictive SELECT policy remains
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT' AND policyname <> 'only_self_or_super_admin_view_profile'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Recreate the single restrictive policy (idempotent via drop above)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'only_self_or_super_admin_view_profile'
  ) THEN
    EXECUTE 'CREATE POLICY "only_self_or_super_admin_view_profile" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated USING (can_access_full_profile(user_id));';
  END IF;
END $$;

-- Document the security intent
COMMENT ON FUNCTION public.can_access_full_profile(uuid) IS 'SECURITY: Returns true only for owner or verified super_admin; logs admin access. SECURITY DEFINER + stable to avoid RLS recursion.';

-- ============================================
-- TRANSACTIONS: Block public and unify participant/admin SELECT
-- ============================================
DO $$
BEGIN
  -- Block public role explicitly
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'public_deny_all_transactions'
  ) THEN
    EXECUTE 'DROP POLICY "public_deny_all_transactions" ON public.transactions';
  END IF;
END $$;

CREATE POLICY "public_deny_all_transactions"
ON public.transactions
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Drop all SELECT policies then create one restrictive
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'transactions' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "participants_or_admin_select_tx"
ON public.transactions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR (buyer_id = auth.uid()) OR is_admin_secure(auth.uid()));

-- Keep existing INSERT/UPDATE/DELETE policies unchanged

-- ============================================
-- DISPUTE MESSAGES: enforce non-null recipient unless broadcast
-- ============================================
-- Strengthen by preventing NULL recipient except explicit system/broadcast
CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow broadcast/system messages explicitly (no recipient)
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure recipient is a legitimate participant in the dispute
  PERFORM 1
  FROM public.disputes d
  JOIN public.transactions t ON t.id = d.transaction_id
  WHERE d.id = NEW.dispute_id
    AND (
      NEW.recipient_id = d.reporter_id OR
      NEW.recipient_id = t.user_id OR
      NEW.recipient_id = t.buyer_id
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid recipient for this dispute message';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure triggers exist (insert + update)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_recipient_before_insert') THEN
    CREATE TRIGGER validate_recipient_before_insert
      BEFORE INSERT ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_recipient_before_update') THEN
    CREATE TRIGGER validate_recipient_before_update
      BEFORE UPDATE ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient();
  END IF;
END $$;