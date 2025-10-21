-- Function to securely assign current user as buyer using token; bypasses RLS safely
CREATE OR REPLACE FUNCTION public.assign_self_as_buyer(p_transaction_id uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate token using existing secure function
  IF NOT public.validate_shared_link_token(p_token, p_transaction_id) THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_tx.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot join your own transaction';
  END IF;

  IF v_tx.buyer_id IS NOT NULL AND v_tx.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'This transaction already has a buyer';
  END IF;

  -- Assign as buyer
  UPDATE public.transactions
  SET buyer_id = auth.uid(),
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN true;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_self_as_buyer(uuid, text) TO authenticated;