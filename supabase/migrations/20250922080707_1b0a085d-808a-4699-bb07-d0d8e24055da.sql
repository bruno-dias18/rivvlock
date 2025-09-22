-- Add display name columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN seller_display_name TEXT,
ADD COLUMN buyer_display_name TEXT;

-- Backfill existing transactions with seller display names
UPDATE public.transactions 
SET seller_display_name = (
  SELECT COALESCE(
    NULLIF(p.company_name, ''),
    TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
  )
  FROM public.profiles p 
  WHERE p.user_id = transactions.user_id
)
WHERE seller_display_name IS NULL;

-- Backfill existing transactions with buyer display names (where buyer exists)
UPDATE public.transactions 
SET buyer_display_name = (
  SELECT COALESCE(
    NULLIF(p.company_name, ''),
    TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
  )
  FROM public.profiles p 
  WHERE p.user_id = transactions.buyer_id
)
WHERE buyer_id IS NOT NULL AND buyer_display_name IS NULL;