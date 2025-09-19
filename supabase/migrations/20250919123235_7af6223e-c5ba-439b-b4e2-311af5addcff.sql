-- Fix the audit trigger that's preventing Stripe customer creation
-- Allow changed_by to be NULL for edge function contexts where auth.uid() returns NULL

-- Drop the existing constraint that requires changed_by to be NOT NULL
ALTER TABLE public.profile_audit_log ALTER COLUMN changed_by DROP NOT NULL;

-- Update the audit function to handle edge function contexts
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sensitive_fields text[] := ARRAY['iban', 'stripe_customer_id', 'avs_number', 'phone', 'address'];
  changed_sensitive_fields jsonb := '{}';
  old_sensitive_values jsonb := '{}';
  new_sensitive_values jsonb := '{}';
  field text;
  current_user_id uuid;
BEGIN
  -- Get current user ID, allowing NULL for edge function contexts
  current_user_id := auth.uid();
  
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
      current_user_id, -- This can now be NULL for edge functions
      TG_OP,
      changed_sensitive_fields,
      old_sensitive_values,
      new_sensitive_values
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;