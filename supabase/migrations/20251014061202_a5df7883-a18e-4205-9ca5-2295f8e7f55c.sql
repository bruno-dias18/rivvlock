-- Améliorer get_next_invoice_sequence avec un composant aléatoire pour éviter l'énumération
CREATE OR REPLACE FUNCTION public.get_next_invoice_sequence(p_seller_id uuid, p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_sequence INTEGER;
  random_component INTEGER;
BEGIN
  -- Ajouter un composant aléatoire (0-999) pour éviter l'énumération prédictible
  random_component := floor(random() * 1000)::integer;
  
  -- Try to get existing sequence with row lock
  SELECT current_sequence + 1 INTO next_sequence
  FROM public.invoice_sequences
  WHERE seller_id = p_seller_id AND year = p_year
  FOR UPDATE;

  -- If no sequence exists, create one with random start
  IF next_sequence IS NULL THEN
    -- Initialiser avec le composant aléatoire pour éviter de commencer à 1
    INSERT INTO public.invoice_sequences (seller_id, year, current_sequence)
    VALUES (p_seller_id, p_year, random_component + 1)
    ON CONFLICT (seller_id, year) DO NOTHING;
    
    next_sequence := random_component + 1;
  ELSE
    -- Update the sequence normally
    UPDATE public.invoice_sequences
    SET current_sequence = next_sequence,
        updated_at = now()
    WHERE seller_id = p_seller_id AND year = p_year;
  END IF;

  RETURN next_sequence;
END;
$$;