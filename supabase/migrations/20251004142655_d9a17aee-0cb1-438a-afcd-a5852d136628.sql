-- Create secure functions to retrieve only necessary profile fields for invoices
-- This prevents full PII exposure while still allowing invoice generation

-- Secure function to get seller invoice data (only fields needed for invoicing)
CREATE OR REPLACE FUNCTION public.get_seller_invoice_data(p_seller_id uuid, p_requesting_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  user_type user_type,
  country country_code,
  address text,
  postal_code text,
  city text,
  siret_uid text,
  vat_rate numeric,
  tva_rate numeric,
  is_subject_to_vat boolean,
  avs_number text,
  vat_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data if the requesting user is part of a transaction with this seller
  IF NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE (t.user_id = p_seller_id AND t.buyer_id = p_requesting_user_id)
       OR (t.buyer_id = p_seller_id AND t.user_id = p_requesting_user_id)
  ) AND NOT is_admin(p_requesting_user_id) THEN
    RETURN;
  END IF;

  -- Return only invoice-relevant fields
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.company_name,
    p.user_type,
    p.country,
    p.address,
    p.postal_code,
    p.city,
    p.siret_uid,
    p.vat_rate,
    p.tva_rate,
    p.is_subject_to_vat,
    p.avs_number,
    p.vat_number
  FROM profiles p
  WHERE p.user_id = p_seller_id;
END;
$$;

-- Secure function to get buyer invoice data (minimal fields)
CREATE OR REPLACE FUNCTION public.get_buyer_invoice_data(p_buyer_id uuid, p_requesting_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  user_type user_type,
  country country_code,
  address text,
  postal_code text,
  city text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data if the requesting user is part of a transaction with this buyer
  IF NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE (t.user_id = p_buyer_id AND t.buyer_id = p_requesting_user_id)
       OR (t.buyer_id = p_buyer_id AND t.user_id = p_requesting_user_id)
  ) AND NOT is_admin(p_requesting_user_id) THEN
    RETURN;
  END IF;

  -- Return only basic fields (no tax IDs for buyers)
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.company_name,
    p.user_type,
    p.country,
    p.address,
    p.postal_code,
    p.city
  FROM profiles p
  WHERE p.user_id = p_buyer_id;
END;
$$;