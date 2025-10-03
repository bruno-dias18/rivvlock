-- Security fix: Consolidate profiles RLS policies (v2 - idempotent)
-- This reduces 11+ overlapping policies to 5 clear, strict policies

-- ============================================================================
-- 1. DROP ALL POLICIES (including any from previous attempts)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_deny_anonymous_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_or_trigger" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_deny_delete" ON public.profiles;

DROP POLICY IF EXISTS "Admins can update all profiles with logging" ON public.profiles;
DROP POLICY IF EXISTS "Allow auth trigger to create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anon deny ALL on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view own profile or admins" ON public.profiles;
DROP POLICY IF EXISTS "Block anon ALL on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anon SELECT on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Secure profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;


-- ============================================================================
-- 2. CREATE CONSOLIDATED, STRICT POLICIES (5 POLICIES TOTAL)
-- ============================================================================

-- Policy 1: Explicitly DENY all anonymous access
CREATE POLICY "profiles_deny_anonymous_all"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Policy 2: SELECT - Users see their own profile, admins see all
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR is_admin_secure(auth.uid())
);

-- Policy 3: INSERT - Only for own profile OR by auth trigger
CREATE POLICY "profiles_insert_own_or_trigger"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id) 
  OR 
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = profiles.user_id
  ))
);

-- Policy 4: UPDATE - Own profile or admin with strict validation
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (can_access_full_profile(user_id))
WITH CHECK (can_access_full_profile(user_id));

-- Policy 5: DELETE - Denied (must delete auth.users instead)
CREATE POLICY "profiles_deny_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);


-- ============================================================================
-- 3. STRENGTHEN can_access_full_profile FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_full_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_requesting_user uuid;
BEGIN
  v_requesting_user := auth.uid();
  
  IF v_requesting_user IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_requesting_user = profile_user_id THEN
    RETURN true;
  END IF;
  
  v_is_admin := is_admin_secure(v_requesting_user);
  
  IF v_is_admin THEN
    PERFORM log_admin_profile_access(profile_user_id, v_requesting_user);
  END IF;
  
  RETURN v_is_admin;
END;
$function$;


-- ============================================================================
-- 4. REVOKE UNNECESSARY PRIVILEGES
-- ============================================================================

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;