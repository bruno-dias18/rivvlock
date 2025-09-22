-- Refine validation function to avoid false IBAN positives and only check changed, user-entered fields
CREATE OR REPLACE FUNCTION public.validate_no_sensitive_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  table_name text := TG_TABLE_NAME;
  changed_text text := '';
  cc_pattern text := '(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}|\b\d{13,19}\b)';
  -- More precise IBAN regex with valid country codes and word boundaries
  iban_pattern text := '\b(?:AL|AD|AT|AZ|BH|BE|BA|BR|BG|CR|HR|CY|CZ|DK|DO|EG|EE|FO|FI|FR|GE|DE|GI|GR|GL|GT|HU|IS|IQ|IE|IL|IT|JO|KZ|XK|KW|LV|LB|LI|LT|LU|MT|MR|MU|MD|MC|ME|NL|NO|PK|PS|PL|PT|QA|RO|LC|SM|SA|RS|SC|SK|SI|ES|SE|CH|TL|TN|TR|UA|AE|GB|VG)\d{2}[A-Z0-9]{11,30}\b';
  bic_pattern text := '\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b';
  account_pattern text := '\b\d{10,18}\b';
BEGIN
  -- Only validate when user-supplied text fields are inserted/changed
  IF TG_OP = 'UPDATE' THEN
    IF table_name = 'transactions' THEN
      IF (NEW.title IS DISTINCT FROM OLD.title) THEN changed_text := changed_text || ' ' || coalesce(NEW.title,''); END IF;
      IF (NEW.description IS DISTINCT FROM OLD.description) THEN changed_text := changed_text || ' ' || coalesce(NEW.description,''); END IF;
      IF (NEW.seller_display_name IS DISTINCT FROM OLD.seller_display_name) THEN changed_text := changed_text || ' ' || coalesce(NEW.seller_display_name,''); END IF;
      IF (NEW.buyer_display_name IS DISTINCT FROM OLD.buyer_display_name) THEN changed_text := changed_text || ' ' || coalesce(NEW.buyer_display_name,''); END IF;
    ELSIF table_name = 'profiles' THEN
      IF (NEW.address IS DISTINCT FROM OLD.address) THEN changed_text := changed_text || ' ' || coalesce(NEW.address,''); END IF;
      IF (NEW.phone IS DISTINCT FROM OLD.phone) THEN changed_text := changed_text || ' ' || coalesce(NEW.phone,''); END IF;
      IF (NEW.avs_number IS DISTINCT FROM OLD.avs_number) THEN changed_text := changed_text || ' ' || coalesce(NEW.avs_number,''); END IF;
      IF (NEW.company_name IS DISTINCT FROM OLD.company_name) THEN changed_text := changed_text || ' ' || coalesce(NEW.company_name,''); END IF;
      IF (NEW.company_address IS DISTINCT FROM OLD.company_address) THEN changed_text := changed_text || ' ' || coalesce(NEW.company_address,''); END IF;
    ELSIF table_name = 'messages' THEN
      IF (NEW.content IS DISTINCT FROM OLD.content) THEN changed_text := changed_text || ' ' || coalesce(NEW.content,''); END IF;
    END IF;
  ELSE
    -- INSERT: validate initial values of user-supplied text fields
    IF table_name = 'transactions' THEN
      changed_text := coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,'') || ' ' || coalesce(NEW.seller_display_name,'') || ' ' || coalesce(NEW.buyer_display_name,'');
    ELSIF table_name = 'profiles' THEN
      changed_text := coalesce(NEW.address,'') || ' ' || coalesce(NEW.phone,'') || ' ' || coalesce(NEW.avs_number,'') || ' ' || coalesce(NEW.company_name,'') || ' ' || coalesce(NEW.company_address,'');
    ELSIF table_name = 'messages' THEN
      changed_text := coalesce(NEW.content,'');
    END IF;
  END IF;

  -- If nothing relevant changed in UPDATE, skip validation
  IF TG_OP = 'UPDATE' AND changed_text = '' THEN
    RETURN NEW;
  END IF;

  -- Perform pattern checks on the relevant, changed text only
  IF changed_text ~* iban_pattern THEN
    RAISE EXCEPTION 'Sensitive data detected: IBAN patterns not allowed. Use Stripe Connect.';
  END IF;

  IF changed_text ~* cc_pattern THEN
    RAISE EXCEPTION 'Sensitive data detected: Credit card patterns not allowed. Use Stripe Elements.';
  END IF;

  IF changed_text ~* bic_pattern THEN
    RAISE EXCEPTION 'Sensitive data detected: BIC/SWIFT codes not allowed. Use Stripe Connect.';
  END IF;

  IF changed_text ~* account_pattern THEN
    RAISE EXCEPTION 'Sensitive data detected: Bank account patterns not allowed. Use Stripe Connect.';
  END IF;

  RETURN NEW;
END;
$function$;