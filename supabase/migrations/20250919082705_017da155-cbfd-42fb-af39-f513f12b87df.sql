-- Security Fix: Drop and recreate admin access policies for profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Allow admins to view all profiles for support and compliance purposes
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT 
USING (is_admin(auth.uid()));

-- Allow admins to update profiles for support purposes (but not create/delete)
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Security Fix: Update the is_admin function to be more secure (remove email exposure)
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_roles ar 
    WHERE ar.user_id = check_user_id 
    AND ar.role = 'admin'
  )
$$;

-- Security Fix: Update admin_roles policies to be more restrictive
DROP POLICY IF EXISTS "Admins can view admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Only super admin can manage admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Users can view their own admin status" ON public.admin_roles;
DROP POLICY IF EXISTS "Super admin can manage admin roles" ON public.admin_roles;

-- Only allow users to view their own admin role status
CREATE POLICY "Users can view their own admin status" ON public.admin_roles
FOR SELECT 
USING (user_id = auth.uid());

-- Only allow existing admins to manage admin roles (more secure than hardcoded email)
CREATE POLICY "Admins can manage admin roles" ON public.admin_roles
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Security Fix: Add audit logging for sensitive profile changes
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  action text NOT NULL,
  changed_fields jsonb,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.profile_audit_log;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.profile_audit_log
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_fields text[] := ARRAY['iban', 'stripe_customer_id', 'avs_number', 'phone', 'address'];
  changed_sensitive_fields jsonb := '{}';
  old_sensitive_values jsonb := '{}';
  new_sensitive_values jsonb := '{}';
  field text;
BEGIN
  -- Only log changes to sensitive fields
  FOREACH field IN ARRAY sensitive_fields
  LOOP
    IF (TG_OP = 'UPDATE' AND OLD IS DISTINCT FROM NEW) THEN
      IF to_jsonb(OLD) ->> field IS DISTINCT FROM to_jsonb(NEW) ->> field THEN
        changed_sensitive_fields := changed_sensitive_fields || jsonb_build_object(field, true);
        old_sensitive_values := old_sensitive_values || jsonb_build_object(field, to_jsonb(OLD) ->> field);
        new_sensitive_values := new_sensitive_values || jsonb_build_object(field, to_jsonb(NEW) ->> field);
      END IF;
    END IF;
  END LOOP;
  
  -- Insert audit record if sensitive fields were changed
  IF jsonb_object_keys(changed_sensitive_fields) IS NOT NULL THEN
    INSERT INTO public.profile_audit_log (
      profile_id, user_id, changed_by, action, changed_fields, old_values, new_values
    ) VALUES (
      COALESCE(NEW.id, OLD.id),
      COALESCE(NEW.user_id, OLD.user_id),
      auth.uid(),
      TG_OP,
      changed_sensitive_fields,
      old_sensitive_values,
      new_sensitive_values
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit trigger for profiles
DROP TRIGGER IF EXISTS audit_profile_changes_trigger ON public.profiles;
CREATE TRIGGER audit_profile_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();