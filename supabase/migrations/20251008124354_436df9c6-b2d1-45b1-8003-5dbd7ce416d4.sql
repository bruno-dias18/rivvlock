-- Supprimer l'ancienne fonction et recréer avec tous les champs nécessaires
DROP FUNCTION IF EXISTS public.get_buyer_invoice_data(uuid, uuid);

CREATE FUNCTION public.get_buyer_invoice_data(p_buyer_id uuid, p_requesting_user_id uuid)
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
  company_address text, 
  phone text,
  siret_uid text,
  vat_rate numeric,
  tva_rate numeric,
  is_subject_to_vat boolean,
  avs_number text,
  vat_number text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only return data if the requesting user is part of a transaction with this buyer
  IF NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE (t.user_id = p_buyer_id AND t.buyer_id = p_requesting_user_id)
       OR (t.buyer_id = p_buyer_id AND t.user_id = p_requesting_user_id)
  ) AND NOT is_admin(p_requesting_user_id) THEN
    RETURN;
  END IF;

  -- Return all invoice-relevant fields including tax info
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
    p.company_address,
    p.phone,
    p.siret_uid,
    p.vat_rate,
    p.tva_rate,
    p.is_subject_to_vat,
    p.avs_number,
    p.vat_number
  FROM profiles p
  WHERE p.user_id = p_buyer_id;
END;
$function$;