-- Add payment_reference column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_reference TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_payment_reference 
ON public.transactions(payment_reference) 
WHERE payment_reference IS NOT NULL;

-- Function to generate Swiss QRR (QR Reference) with Modulo 10 recursive checksum
-- Format: 27 digits total (26 digits + 1 checksum digit)
-- Structure: [Year(4)][Month(2)][Day(2)][Hour(2)][Min(2)][Sec(2)][Random(12)][Checksum(1)]
CREATE OR REPLACE FUNCTION public.generate_qr_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_timestamp TEXT;
  v_random TEXT;
  v_reference TEXT;
  v_checksum INTEGER;
  v_carry INTEGER := 0;
  v_digit INTEGER;
  v_i INTEGER;
  v_table INTEGER[] := ARRAY[0,9,4,6,8,2,7,1,3,5];
BEGIN
  -- Generate timestamp part (YYYYMMDDHHmmss = 14 digits)
  v_timestamp := to_char(now(), 'YYYYMMDDHH24MISS');
  
  -- Generate 12 random digits
  v_random := LPAD(floor(random() * 1000000000000)::TEXT, 12, '0');
  
  -- Combine (26 digits total)
  v_reference := v_timestamp || v_random;
  
  -- Calculate Modulo 10 recursive checksum
  FOR v_i IN 1..LENGTH(v_reference) LOOP
    v_digit := SUBSTRING(v_reference, v_i, 1)::INTEGER;
    v_carry := v_table[(v_carry + v_digit) % 10 + 1];
  END LOOP;
  
  v_checksum := (10 - v_carry) % 10;
  
  -- Return 27 digits (26 + checksum)
  RETURN v_reference || v_checksum::TEXT;
END;
$$;

-- Function to validate a QRR reference checksum
CREATE OR REPLACE FUNCTION public.validate_qr_reference(p_reference TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_carry INTEGER := 0;
  v_digit INTEGER;
  v_i INTEGER;
  v_table INTEGER[] := ARRAY[0,9,4,6,8,2,7,1,3,5];
BEGIN
  -- Must be exactly 27 digits
  IF LENGTH(p_reference) != 27 OR p_reference !~ '^\d{27}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate checksum for all 27 digits
  FOR v_i IN 1..27 LOOP
    v_digit := SUBSTRING(p_reference, v_i, 1)::INTEGER;
    v_carry := v_table[(v_carry + v_digit) % 10 + 1];
  END LOOP;
  
  -- Valid if final carry is 0
  RETURN v_carry = 0;
END;
$$;

COMMENT ON COLUMN public.transactions.payment_reference IS 'Swiss QR-Invoice structured reference (27 digits) for bank transfer reconciliation';
COMMENT ON FUNCTION public.generate_qr_reference() IS 'Generates a unique 27-digit QR reference with Modulo 10 recursive checksum';
COMMENT ON FUNCTION public.validate_qr_reference(TEXT) IS 'Validates a 27-digit QR reference checksum';