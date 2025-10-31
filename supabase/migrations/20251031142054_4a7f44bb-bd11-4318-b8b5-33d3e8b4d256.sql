-- Add separate payment deadlines for card and bank transfer methods
-- This allows us to show different deadlines based on payment method
-- Card payments are instant, bank transfers take 2-3 business days

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_deadline_card TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_deadline_bank TIMESTAMP WITH TIME ZONE;

-- Set default values for existing transactions
-- Card deadline = current payment_deadline
-- Bank deadline = current payment_deadline - 3 days
UPDATE transactions 
SET 
  payment_deadline_card = payment_deadline,
  payment_deadline_bank = payment_deadline - INTERVAL '3 days'
WHERE payment_deadline_card IS NULL;

-- Add helpful comment
COMMENT ON COLUMN transactions.payment_deadline_card IS 'Deadline for card payments (instant processing)';
COMMENT ON COLUMN transactions.payment_deadline_bank IS 'Deadline for bank transfers (includes 2-3 day processing time)';