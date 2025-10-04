-- Block public role access to audit tables explicitly

-- ============================================
-- STRIPE_ACCOUNT_ACCESS_AUDIT: Block public role
-- ============================================
DO $$
BEGIN
  -- Drop policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'stripe_account_access_audit' AND policyname = 'public_deny_all_stripe_audit'
  ) THEN
    EXECUTE 'DROP POLICY "public_deny_all_stripe_audit" ON public.stripe_account_access_audit';
  END IF;
END $$;

-- Create policy blocking public role
CREATE POLICY "public_deny_all_stripe_audit"
ON public.stripe_account_access_audit
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- ============================================
-- USER_ROLES: Block public role
-- ============================================
DO $$
BEGIN
  -- Drop policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'public_deny_all_user_roles_explicit'
  ) THEN
    EXECUTE 'DROP POLICY "public_deny_all_user_roles_explicit" ON public.user_roles';
  END IF;
END $$;

-- Create policy blocking public role
CREATE POLICY "public_deny_all_user_roles_explicit"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);