-- Add discount_percentage column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_percentage integer DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN quotes.discount_percentage IS 'Discount percentage (0-50) applied to subtotal before tax';