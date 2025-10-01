-- Ensure profiles table has strict RLS and no default grants
-- This will make the view secure since it inherits from profiles with security_invoker

-- 1. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 2. Revoke all default grants on profiles table
REVOKE ALL ON public.profiles FROM PUBLIC;
REVOKE ALL ON public.profiles FROM anon;

-- 3. Grant only to authenticated with RLS enforcement
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- 4. Verify views have security_invoker and proper grants
ALTER VIEW public.profiles_safe_view SET (security_invoker = true);
ALTER VIEW public.transaction_counterparty_profiles SET (security_invoker = true);

-- 5. Ensure no public/anon access to views
REVOKE ALL ON public.profiles_safe_view FROM PUBLIC;
REVOKE ALL ON public.profiles_safe_view FROM anon;
REVOKE ALL ON public.transaction_counterparty_profiles FROM PUBLIC;
REVOKE ALL ON public.transaction_counterparty_profiles FROM anon;

-- 6. Only authenticated users can access views (with RLS from profiles)
GRANT SELECT ON public.profiles_safe_view TO authenticated;
GRANT SELECT ON public.transaction_counterparty_profiles TO authenticated;