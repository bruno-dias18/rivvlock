-- Clean all SELECT policies and create single restrictive ones

-- ============================================
-- STRIPE_ACCOUNTS: Drop all SELECT policies, create one restrictive
-- ============================================
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop ALL SELECT policies on stripe_accounts
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'stripe_accounts'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stripe_accounts', pol.policyname);
  END LOOP;
END $$;

-- Create single restrictive SELECT policy
CREATE POLICY "only_owner_or_admin_view_stripe"
ON public.stripe_accounts
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR is_admin_secure(auth.uid()));

-- ============================================
-- PROFILES: Drop all SELECT policies, create one restrictive
-- ============================================
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop ALL SELECT policies on profiles
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Create single restrictive SELECT policy using security definer function
CREATE POLICY "only_self_or_super_admin_view_profile"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (can_access_full_profile(user_id));

-- ============================================
-- DISPUTE_MESSAGES: Add triggers to enforce recipient validation
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_recipient_before_insert'
  ) THEN
    CREATE TRIGGER validate_recipient_before_insert
      BEFORE INSERT ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_recipient_before_update'
  ) THEN
    CREATE TRIGGER validate_recipient_before_update
      BEFORE UPDATE ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient();
  END IF;
END $$;