-- Modifier la fonction get_buyer_invoice_data pour retourner plus de champs
DROP FUNCTION IF EXISTS public.get_buyer_invoice_data(uuid, uuid);

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
  city text,
  company_address text,
  phone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
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

  -- Return basic fields including phone for invoicing
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
    p.phone
  FROM profiles p
  WHERE p.user_id = p_buyer_id;
END;
$$;