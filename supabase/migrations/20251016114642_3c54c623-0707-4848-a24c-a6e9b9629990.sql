-- Drop existing trigger
DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;

-- Create improved trigger function that doesn't update updated_at when only client_last_viewed_at changes
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update updated_at if columns other than client_last_viewed_at changed
  IF (NEW.client_last_viewed_at IS DISTINCT FROM OLD.client_last_viewed_at) AND
     (NEW.title = OLD.title AND 
      NEW.description IS NOT DISTINCT FROM OLD.description AND
      NEW.items = OLD.items AND
      NEW.total_amount = OLD.total_amount AND
      NEW.status = OLD.status AND
      NEW.subtotal = OLD.subtotal AND
      NEW.tax_rate IS NOT DISTINCT FROM OLD.tax_rate AND
      NEW.tax_amount IS NOT DISTINCT FROM OLD.tax_amount AND
      NEW.service_date IS NOT DISTINCT FROM OLD.service_date AND
      NEW.service_end_date IS NOT DISTINCT FROM OLD.service_end_date AND
      NEW.valid_until = OLD.valid_until AND
      NEW.fee_ratio_client IS NOT DISTINCT FROM OLD.fee_ratio_client AND
      NEW.discount_percentage IS NOT DISTINCT FROM OLD.discount_percentage) THEN
    -- Only client_last_viewed_at changed, don't update updated_at
    RETURN NEW;
  ELSE
    -- Other fields changed, update updated_at
    NEW.updated_at = now();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();