-- ====================================
-- CORRECTION DES AVERTISSEMENTS DE SÉCURITÉ
-- ====================================

-- 1. Corriger les fonctions sans search_path défini

-- Fonction validate_invoice_participants
CREATE OR REPLACE FUNCTION public.validate_invoice_participants()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RAISE EXCEPTION 'seller_id cannot be null';
  END IF;
  
  IF NEW.buyer_id IS NULL THEN
    RAISE EXCEPTION 'buyer_id cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fonction validate_dispute_message_recipient
CREATE OR REPLACE FUNCTION public.validate_dispute_message_recipient()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RAISE NOTICE 'Dispute message without explicit recipient_id will be visible to all dispute participants';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Améliorer la fonction update_updated_at_column avec search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Améliorer la fonction handle_new_user avec search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.raw_user_meta_data ? 'user_type') AND (NEW.raw_user_meta_data ? 'country') THEN
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
        NULL,
        COALESCE((NEW.raw_user_meta_data->>'acceptance_terms')::boolean, false),
        COALESCE((NEW.raw_user_meta_data->>'registration_complete')::boolean, false)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Améliorer la fonction handle_admin_role_assignment avec search_path
CREATE OR REPLACE FUNCTION public.handle_admin_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'bruno-dias@outlook.com' THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;