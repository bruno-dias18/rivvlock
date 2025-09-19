-- Remove IBAN field from profiles table as it stores sensitive data
ALTER TABLE public.profiles DROP COLUMN IF EXISTS iban;

-- Add index for better performance on stripe_customer_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

-- Add index for stripe_accounts user lookups
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user_id ON public.stripe_accounts(user_id);

-- Update validation function to be more comprehensive
CREATE OR REPLACE FUNCTION public.validate_no_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for potential sensitive data patterns in text fields
  IF (TG_TABLE_NAME = 'profiles' OR TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'messages') THEN
    -- Check for IBAN patterns (enhanced check)
    IF NEW::text ~* '[A-Z]{2}\d{2}[A-Z0-9]{10,30}' THEN
      RAISE EXCEPTION 'Sensitive data detected: IBAN patterns not allowed. Use Stripe Connect.';
    END IF;
    
    -- Check for credit card patterns (enhanced)
    IF NEW::text ~* '(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{13,19})' THEN
      RAISE EXCEPTION 'Sensitive data detected: Credit card patterns not allowed. Use Stripe Elements.';
    END IF;
    
    -- Check for BIC/SWIFT codes
    IF NEW::text ~* '[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' THEN
      RAISE EXCEPTION 'Sensitive data detected: BIC/SWIFT codes not allowed. Use Stripe Connect.';
    END IF;
    
    -- Check for potential bank account numbers
    IF NEW::text ~* '\b\d{10,18}\b' THEN
      RAISE EXCEPTION 'Sensitive data detected: Bank account patterns not allowed. Use Stripe Connect.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create security audit function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type TEXT,
  details JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  -- Log security events (can be extended to external monitoring)
  INSERT INTO public.profile_audit_log (
    profile_id, user_id, changed_by, action, changed_fields, old_values, new_values
  ) VALUES (
    NULL, auth.uid(), auth.uid(), 
    'SECURITY_EVENT', 
    jsonb_build_object('event_type', event_type),
    jsonb_build_object('timestamp', now()),
    details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;