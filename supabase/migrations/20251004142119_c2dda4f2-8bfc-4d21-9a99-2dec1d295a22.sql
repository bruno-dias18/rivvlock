-- 1) Create app_role enum with secure role set
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('user','moderator','admin','super_admin');
  END IF;
END $$;

-- 2) Create user_roles table (separate from profiles/auth)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Core role-check function using SECURITY DEFINER (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$$;

-- 4) Seed user_roles from existing admin_roles (one-time sync)
INSERT INTO public.user_roles (user_id, role)
SELECT ar.user_id,
       CASE WHEN ar.role = 'super_admin' THEN 'super_admin'::public.app_role ELSE 'admin'::public.app_role END
FROM public.admin_roles ar
ON CONFLICT (user_id, role) DO NOTHING;

-- 5) Harden admin helper functions to rely on has_role (no recursion on admin_roles)
CREATE OR REPLACE FUNCTION public.check_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_secure(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'super_admin'::public.app_role);
$$;

-- 6) Update existing RPC used by the app to check admin status
CREATE OR REPLACE FUNCTION public.get_current_user_admin_status()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- 7) RLS for user_roles (only super_admin can manage; users can read own)
DO $$ BEGIN
  -- Drop existing policies if re-running
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles'
  ) THEN
    -- Clean slate
    DROP POLICY IF EXISTS "Only super admins can manage user roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
  END IF;
END $$;

CREATE POLICY "Only super admins can manage user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 8) Helpful index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);
