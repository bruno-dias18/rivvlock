-- Update the handle_new_user function to include postal_code and city
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create profile if required fields are present in metadata
  IF (NEW.raw_user_meta_data ? 'user_type') AND (NEW.raw_user_meta_data ? 'country') THEN
    -- Avoid duplicates if profile already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.id
    ) THEN
      INSERT INTO public.profiles (
        user_id,
        user_type,
        country,
        verified,
        first_name,
        last_name,
        phone,
        address,
        postal_code,
        city,
        company_name,
        siret_uid,
        company_address,
        avs_number,
        tva_rate,
        vat_rate,
        stripe_customer_id,
        acceptance_terms,
        registration_complete
      ) VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'user_type')::user_type,
        (NEW.raw_user_meta_data->>'country')::country_code,
        false,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'address',
        NEW.raw_user_meta_data->>'postal_code',
        NEW.raw_user_meta_data->>'city',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'siret_uid',
        NEW.raw_user_meta_data->>'company_address',
        NEW.raw_user_meta_data->>'avs_number',
        NULLIF(NEW.raw_user_meta_data->>'tva_rate','')::numeric,
        NULLIF(NEW.raw_user_meta_data->>'vat_rate','')::numeric,
        NULL,  -- Will be populated by the edge function
        COALESCE((NEW.raw_user_meta_data->>'acceptance_terms')::boolean, false),
        COALESCE((NEW.raw_user_meta_data->>'registration_complete')::boolean, false)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$