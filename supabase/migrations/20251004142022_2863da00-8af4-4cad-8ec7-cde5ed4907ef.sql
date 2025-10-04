-- Tighten PII access: restrict admin SELECT/UPDATE on profiles to super_admin only
-- 1) Update helper to gate admin access to super_admin
CREATE OR REPLACE FUNCTION public.can_access_full_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_super_admin boolean;
  v_requesting_user uuid;
BEGIN
  v_requesting_user := auth.uid();
  IF v_requesting_user IS NULL THEN
    RETURN false;
  END IF;
  IF v_requesting_user = profile_user_id THEN
    RETURN true;
  END IF;
  -- Only super admins can access another user's full profile
  v_is_super_admin := public.is_super_admin(v_requesting_user);
  IF v_is_super_admin THEN
    PERFORM public.log_admin_profile_access(profile_user_id, v_requesting_user);
  END IF;
  RETURN v_is_super_admin;
END;
$$;

-- 2) Recreate SELECT policy on profiles to require super_admin for cross-user reads
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own_or_admin'
  ) THEN
    DROP POLICY "profiles_select_own_or_admin" ON public.profiles;
  END IF;
END $$;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING ((auth.uid() = user_id) OR public.is_super_admin(auth.uid()));

-- 3) Limit admin-wide transaction visibility (tokens) to super_admin
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='Admins can view all transactions'
  ) THEN
    DROP POLICY "Admins can view all transactions" ON public.transactions;
  END IF;
END $$;

CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
USING (public.is_super_admin(auth.uid()));
