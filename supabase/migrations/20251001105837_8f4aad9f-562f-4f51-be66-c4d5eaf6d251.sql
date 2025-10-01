-- Ensure profiles_safe_view is properly secured with security_invoker
-- This makes the view respect RLS policies from the underlying profiles table

-- Revoke all public access
REVOKE ALL ON public.profiles_safe_view FROM PUBLIC;
REVOKE ALL ON public.profiles_safe_view FROM anon;

-- Only grant to authenticated users - RLS from profiles table will restrict access
GRANT SELECT ON public.profiles_safe_view TO authenticated;

-- Verify the view is using security_invoker
ALTER VIEW public.profiles_safe_view SET (security_invoker = true);

-- Ensure the underlying profiles table has RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add a comment explaining the security model
COMMENT ON VIEW public.profiles_safe_view IS 
'Safe view of profiles with non-sensitive fields. Uses security_invoker=true to enforce RLS policies from the underlying profiles table. Users can only see profiles they have permission to access based on profiles table RLS policies.';