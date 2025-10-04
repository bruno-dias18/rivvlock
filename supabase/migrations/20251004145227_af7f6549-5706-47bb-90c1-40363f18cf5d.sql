-- CRITICAL FIX: Complete policy reset for audit tables
-- Force drop ALL existing policies and recreate with proper security

-- ============================================
-- 1. STRIPE ACCOUNT ACCESS AUDIT: Complete reset
-- ============================================

-- Force drop ALL policies on this table
DO $$ 
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'stripe_account_access_audit' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stripe_account_access_audit', policy_record.policyname);
  END LOOP;
END $$;

-- Now create fresh policies
CREATE POLICY "Block anon ALL stripe audit"
ON public.stripe_account_access_audit
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Block public SELECT stripe audit"
ON public.stripe_account_access_audit
FOR SELECT
USING (false);

CREATE POLICY "Admins view stripe audit"
ON public.stripe_account_access_audit
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "System insert stripe audit"
ON public.stripe_account_access_audit
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- 2. USER_ROLES: Complete reset
-- ============================================

-- Force drop ALL policies on user_roles
DO $$ 
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', policy_record.policyname);
  END LOOP;
END $$;

-- Now create fresh policies for user_roles
CREATE POLICY "Block anon ALL user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Super admins manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'super_admin'::app_role));