-- Fix security warnings: Add search_path to all new functions

-- 1. Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Fix create_kyc_status_on_profile
CREATE OR REPLACE FUNCTION create_kyc_status_on_profile()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kyc_status (user_id, status)
  VALUES (NEW.user_id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Fix can_create_transaction
CREATE OR REPLACE FUNCTION can_create_transaction(p_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc_status TEXT;
  v_total_volume NUMERIC;
BEGIN
  -- Récupérer le statut KYC
  SELECT status INTO v_kyc_status
  FROM public.kyc_status
  WHERE user_id = p_user_id;
  
  -- Si pas de KYC vérifié, limiter à CHF 1'000
  IF v_kyc_status IS NULL OR v_kyc_status != 'approved' THEN
    SELECT COALESCE(SUM(price), 0) INTO v_total_volume
    FROM public.transactions
    WHERE user_id = p_user_id
      AND status != 'cancelled'
      AND created_at > (now() - INTERVAL '1 year');
    
    RETURN v_total_volume < 1000;
  END IF;
  
  -- Si KYC vérifié, pas de limite
  RETURN true;
END;
$$;

-- 4. Fix get_adyen_accounting_summary
CREATE OR REPLACE FUNCTION get_adyen_accounting_summary()
RETURNS TABLE(
  total_captured NUMERIC,
  total_owed_to_sellers NUMERIC,
  total_platform_commission NUMERIC,
  total_estimated_fees NUMERIC,
  total_net_revenue NUMERIC,
  pending_payouts_amount NUMERIC,
  pending_payouts_count BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(gross_amount)::NUMERIC / 100, 0) as total_captured,
    COALESCE(SUM(seller_amount)::NUMERIC / 100, 0) as total_owed_to_sellers,
    COALESCE(SUM(platform_commission)::NUMERIC / 100, 0) as total_platform_commission,
    COALESCE(SUM(estimated_processor_fees)::NUMERIC / 100, 0) as total_estimated_fees,
    COALESCE(SUM(net_platform_revenue)::NUMERIC / 100, 0) as total_net_revenue,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN seller_amount ELSE 0 END)::NUMERIC / 100, 0) as pending_payouts_amount,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_payouts_count
  FROM public.adyen_payouts;
END;
$$;