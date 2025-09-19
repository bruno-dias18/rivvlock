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

-- Drop existing policy if exists and create new one
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.profile_audit_log;
CREATE POLICY "Admins can view audit logs" ON public.profile_audit_log
FOR SELECT 
USING (is_admin(auth.uid()));

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs" ON public.profile_audit_log
FOR SELECT 
USING (user_id = auth.uid());

-- Create audit trigger function
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
        old_sensitive_values := old_sensitive_values || jsonb_build_object(field, '[REDACTED]');
        new_sensitive_values := new_sensitive_values || jsonb_build_object(field, '[REDACTED]');
      END IF;
    END IF;
  END LOOP;
  
  -- Insert audit record if sensitive fields were changed
  IF jsonb_object_keys(changed_sensitive_fields) != '[]' THEN
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

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_profile_changes_trigger ON public.profiles;
CREATE TRIGGER audit_profile_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();