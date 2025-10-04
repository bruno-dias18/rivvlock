-- Final hardening to clear remaining non-accepted warnings
-- A) Strengthen profiles SELECT policy (restrictive, via security-definer function)
-- B) Simplify and restrict stripe_accounts SELECT policy (single restrictive policy)
-- C) Enforce dispute_messages recipient validation via triggers (insert + update)

-- ============================================
-- A) PROFILES: Restrictive SELECT policy using can_access_full_profile
-- ============================================
DO $$
BEGIN
  -- Replace existing SELECT policy with a restrictive one
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own_or_admin'
  ) THEN
    EXECUTE 'DROP POLICY "profiles_select_own_or_admin" ON public.profiles';
  END IF;
END $$;

-- Create restrictive SELECT policy using the secure definer function
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (can_access_full_profile(user_id));

-- ============================================
-- B) STRIPE ACCOUNTS: Single restrictive SELECT policy
-- ============================================
DO $$
BEGIN
  -- Drop duplicate/overlapping SELECT policies to avoid ambiguity
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'stripe_accounts' AND policyname = 'Authenticated can view own stripe account or admins'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated can view own stripe account or admins" ON public.stripe_accounts';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'stripe_accounts' AND policyname = 'Secure stripe account access'
  ) THEN
    EXECUTE 'DROP POLICY "Secure stripe account access" ON public.stripe_accounts';
  END IF;
END $$;

-- Add a single restrictive policy: only owner or admins can SELECT
CREATE POLICY "restrict_owner_or_admin_select_stripe_accounts"
ON public.stripe_accounts
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR is_admin_secure(auth.uid()));

-- ============================================
-- C) DISPUTE MESSAGES: Enforce recipient validity on INSERT and UPDATE
-- ============================================
-- Create triggers if not exist to enforce recipient is a participant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_dispute_message_recipient_insert'
  ) THEN
    EXECUTE 'CREATE TRIGGER validate_dispute_message_recipient_insert
      BEFORE INSERT ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient()';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_dispute_message_recipient_update'
  ) THEN
    EXECUTE 'CREATE TRIGGER validate_dispute_message_recipient_update
      BEFORE UPDATE ON public.dispute_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_dispute_message_recipient()';
  END IF;
END $$;