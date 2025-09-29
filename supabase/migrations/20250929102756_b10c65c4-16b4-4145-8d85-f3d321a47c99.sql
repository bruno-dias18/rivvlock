-- Create function to atomically get next invoice sequence
CREATE OR REPLACE FUNCTION public.get_next_invoice_sequence(
  p_seller_id UUID,
  p_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_sequence INTEGER;
BEGIN
  -- Try to get existing sequence with row lock
  SELECT current_sequence + 1 INTO next_sequence
  FROM public.invoice_sequences
  WHERE seller_id = p_seller_id AND year = p_year
  FOR UPDATE;

  -- If no sequence exists, create one
  IF next_sequence IS NULL THEN
    INSERT INTO public.invoice_sequences (seller_id, year, current_sequence)
    VALUES (p_seller_id, p_year, 1)
    ON CONFLICT (seller_id, year) DO NOTHING;
    
    next_sequence := 1;
  ELSE
    -- Update the sequence
    UPDATE public.invoice_sequences
    SET current_sequence = next_sequence,
        updated_at = now()
    WHERE seller_id = p_seller_id AND year = p_year;
  END IF;

  RETURN next_sequence;
END;
$$;