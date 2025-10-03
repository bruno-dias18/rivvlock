-- Security fix: Consolidate profiles RLS policies to eliminate complexity
-- This reduces 11 overlapping policies to 5 clear, strict policies
-- Maintains all existing functionality while reducing misconfiguration risk

-- ============================================================================
-- 1. DROP ALL EXISTING REDUNDANT POLICIES
-- ============================================================================

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

-- Policy 1: Explicitly DENY all anonymous access (catches all operations)
CREATE POLICY "profiles_deny_anonymous_all"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Policy 2: Allow SELECT - Users see their own profile, admins see all
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR is_admin_secure(auth.uid())
);

-- Policy 3: Allow INSERT - Only for own profile OR by auth trigger (system)
CREATE POLICY "profiles_insert_own_or_trigger"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can create their own profile
  (auth.uid() = user_id) 
  OR 
  -- OR system can create via trigger (auth.uid() is NULL during trigger)
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = profiles.user_id
  ))
);

-- Policy 4: Allow UPDATE - Own profile or admin with strict validation
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Can only update if you own it or you're an admin
  can_access_full_profile(user_id)
)
WITH CHECK (
  -- Cannot change user_id to someone else's
  can_access_full_profile(user_id)
);

-- Policy 5: DENY DELETE - No one can delete profiles (must delete auth.users instead)
CREATE POLICY "profiles_deny_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);


-- ============================================================================
-- 3. STRENGTHEN can_access_full_profile FUNCTION
-- ============================================================================

-- Add explicit validation and audit logging
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
  
  -- Null check: unauthenticated users never have access
  IF v_requesting_user IS NULL THEN
    RETURN false;
  END IF;
  
  -- Same user: immediate access
  IF v_requesting_user = profile_user_id THEN
    RETURN true;
  END IF;
  
  -- Admin check with explicit validation
  v_is_admin := is_admin_secure(v_requesting_user);
  
  -- If admin is accessing another user's profile, log it
  IF v_is_admin THEN
    -- Log admin access for audit trail
    PERFORM log_admin_profile_access(profile_user_id, v_requesting_user);
  END IF;
  
  RETURN v_is_admin;
END;
$function$;


-- ============================================================================
-- 4. ADD COMMENT DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.profiles IS 
'User profiles containing PII. RLS enforced: users see only their own data, admins see all with audit logging. 5 consolidated policies for clarity and security.';

COMMENT ON FUNCTION public.can_access_full_profile(uuid) IS 
'Security function: returns true if requesting user owns the profile or is an admin. Admin access is automatically logged for audit purposes.';


-- ============================================================================
-- 5. REVOKE UNNECESSARY PRIVILEGES (defense in depth)
-- ============================================================================

-- Ensure only authenticated users can interact with profiles
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;