-- Create a secure function to get transaction by token
-- This bypasses RLS and provides a safe subset of transaction data
CREATE OR REPLACE FUNCTION public.get_transaction_by_token_safe(p_token text)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  price numeric,
  currency currency_code,
  seller_display_name text,
  buyer_display_name text,
  service_date timestamp with time zone,
  service_end_date timestamp with time zone,
  payment_deadline timestamp with time zone,
  status transaction_status,
  shared_link_expires_at timestamp with time zone,
  is_expired boolean,
  user_id uuid,
  buyer_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_is_expired boolean;
BEGIN
  -- Find transaction by token
  SELECT * INTO v_transaction
  FROM public.transactions t
  WHERE t.shared_link_token = p_token;
  
  IF NOT FOUND THEN
    -- Token doesn't exist, return empty
    RETURN;
  END IF;
  
  -- Check if expired
  v_is_expired := (v_transaction.shared_link_expires_at IS NOT NULL 
                   AND v_transaction.shared_link_expires_at < now());
  
  -- Return safe subset of data
  RETURN QUERY
  SELECT 
    v_transaction.id,
    v_transaction.title,
    v_transaction.description,
    v_transaction.price,
    v_transaction.currency,
    v_transaction.seller_display_name,
    v_transaction.buyer_display_name,
    v_transaction.service_date,
    v_transaction.service_end_date,
    v_transaction.payment_deadline,
    v_transaction.status,
    v_transaction.shared_link_expires_at,
    v_is_expired,
    v_transaction.user_id,
    v_transaction.buyer_id;
END;
$$;