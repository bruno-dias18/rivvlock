-- Grant admin role to the primary admin account
-- Ensures that the user bruno-dias@outlook.com has the 'admin' app_role
-- Safe to run multiple times due to ON CONFLICT DO NOTHING

-- 1) Insert admin role for the specific email if missing
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'bruno-dias@outlook.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Optional sanity check: ensure at least one admin exists (no-op if already present)
-- This SELECT does not modify data but is useful to confirm after execution:
-- SELECT COUNT(*) AS admin_count FROM public.user_roles WHERE role = 'admin'::public.app_role;