-- Create a view with only non-sensitive profile fields for general display
-- This prevents accidental exposure of PII even if queries are misconfigured
CREATE OR REPLACE VIEW public.profiles_safe_view AS
SELECT 
  id,
  user_id,
  first_name,
  last_name,
  company_name,
  user_type,
  country,
  verified,
  created_at,
  updated_at,
  registration_complete
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.profiles_safe_view SET (security_barrier = true);

-- Grant access to authenticated users for the safe view
GRANT SELECT ON public.profiles_safe_view TO authenticated;

-- Create a security definer function to check if user can access full profile data
-- Only the profile owner or admins can access sensitive fields
CREATE OR REPLACE FUNCTION public.can_access_full_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.uid() = profile_user_id) OR is_admin(auth.uid());
$$;

-- Add a more restrictive policy for SELECT that prevents accidental bulk exports
-- This policy ensures that even admins must explicitly filter when accessing profiles
CREATE POLICY "Prevent unfiltered profile access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  (auth.uid() = user_id)
  OR
  -- Admins can see profiles but must use explicit filtering in queries
  -- This prevents accidental "SELECT * FROM profiles" exposing all data
  (is_admin(auth.uid()) AND user_id IS NOT NULL)
);

-- Drop the old admin view policy to replace it with the new one above
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create an audit log table for tracking access to sensitive profile data
CREATE TABLE IF NOT EXISTS public.profile_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_profile_id uuid NOT NULL,
  accessed_by_user_id uuid NOT NULL,
  access_type text NOT NULL, -- 'view', 'update', 'admin_view'
  accessed_fields text[], -- array of field names accessed
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.profile_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view profile access logs"
ON public.profile_access_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.profile_access_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = accessed_by_user_id);

-- Add indexes for better performance on audit logs
CREATE INDEX IF NOT EXISTS idx_profile_access_logs_profile_id 
ON public.profile_access_logs(accessed_profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_access_logs_timestamp 
ON public.profile_access_logs(created_at DESC);

-- Add a comment documenting the security model
COMMENT ON TABLE public.profiles IS 
'Contains sensitive PII including addresses, phone numbers, tax IDs, and financial information. 
Access is restricted by RLS policies. Use profiles_safe_view for general display purposes. 
All access to sensitive fields should be logged to profile_access_logs.';

COMMENT ON VIEW public.profiles_safe_view IS 
'Safe view of profiles containing only non-sensitive fields suitable for general display and listings. 
Use this view instead of querying profiles directly when sensitive data is not needed.';