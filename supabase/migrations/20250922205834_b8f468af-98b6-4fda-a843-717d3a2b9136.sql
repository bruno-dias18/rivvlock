-- Create unique index on user_id for admin_roles table
CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_user_id_unique_idx ON public.admin_roles (user_id);

-- Fix the handle_admin_role_assignment function to not reference non-existent email column
CREATE OR REPLACE FUNCTION public.handle_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If the user email is bruno-dias@outlook.com, automatically add admin role
  IF NEW.email = 'bruno-dias@outlook.com' THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;