-- 1) Ensure handle_new_user inserts a profile from user metadata if available
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        company_name,
        siret_uid,
        company_address,
        iban,
        avs_number,
        tva_rate,
        vat_rate
      ) VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'user_type')::public.user_type,
        (NEW.raw_user_meta_data->>'country')::public.country_code,
        false,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'address',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'siret_uid',
        NEW.raw_user_meta_data->>'company_address',
        NEW.raw_user_meta_data->>'iban',
        NEW.raw_user_meta_data->>'avs_number',
        NULLIF(NEW.raw_user_meta_data->>'tva_rate','')::numeric,
        NULLIF(NEW.raw_user_meta_data->>'vat_rate','')::numeric
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Create trigger on auth.users to call the function after user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill: create missing profiles for existing users when metadata is available
INSERT INTO public.profiles (
  user_id,
  user_type,
  country,
  verified,
  first_name,
  last_name,
  phone,
  address,
  company_name,
  siret_uid,
  company_address,
  iban,
  avs_number,
  tva_rate,
  vat_rate
)
SELECT 
  u.id,
  (u.raw_user_meta_data->>'user_type')::public.user_type,
  (u.raw_user_meta_data->>'country')::public.country_code,
  false,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  u.raw_user_meta_data->>'phone',
  u.raw_user_meta_data->>'address',
  u.raw_user_meta_data->>'company_name',
  u.raw_user_meta_data->>'siret_uid',
  u.raw_user_meta_data->>'company_address',
  u.raw_user_meta_data->>'iban',
  u.raw_user_meta_data->>'avs_number',
  NULLIF(u.raw_user_meta_data->>'tva_rate','')::numeric,
  NULLIF(u.raw_user_meta_data->>'vat_rate','')::numeric
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
  AND (u.raw_user_meta_data ? 'user_type')
  AND (u.raw_user_meta_data ? 'country');