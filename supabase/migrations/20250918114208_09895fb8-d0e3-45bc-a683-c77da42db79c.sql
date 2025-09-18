-- Create admin roles table
CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for admin roles
CREATE POLICY "Admins can view admin roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.admin_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.email = 'bruno-dias@outlook.com'
  )
);

CREATE POLICY "Only super admin can manage admin roles"
ON public.admin_roles
FOR ALL
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.email = 'bruno-dias@outlook.com'
  )
);

-- Insert bruno-dias@outlook.com as the main admin (will be linked to user_id when they login)
-- For now, we'll create a trigger to handle this automatically when the user signs up

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_roles ar 
    JOIN auth.users u ON ar.user_id = u.id
    WHERE ar.user_id = check_user_id 
    AND (u.email = 'bruno-dias@outlook.com' OR ar.email = 'bruno-dias@outlook.com')
  )
$$;

-- Create function to handle admin role assignment
CREATE OR REPLACE FUNCTION public.handle_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user email is bruno-dias@outlook.com, automatically add admin role
  IF NEW.email = 'bruno-dias@outlook.com' THEN
    INSERT INTO public.admin_roles (user_id, email, role)
    VALUES (NEW.id, NEW.email, 'admin')
    ON CONFLICT (user_id, email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for admin role assignment
CREATE TRIGGER on_auth_user_admin_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_role_assignment();

-- Add updated_at trigger for admin_roles
CREATE TRIGGER update_admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();