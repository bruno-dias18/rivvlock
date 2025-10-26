-- Add columns to track payment provider (Stripe or Adyen)
ALTER TABLE transactions
  ADD COLUMN payment_provider TEXT DEFAULT 'stripe' 
  CHECK (payment_provider IN ('stripe', 'adyen'));

-- Add column for Adyen PSP reference (equivalent of stripe_payment_intent_id)
ALTER TABLE transactions
  ADD COLUMN adyen_psp_reference TEXT NULL;

-- Create indexes for performance
CREATE INDEX idx_transactions_payment_provider ON transactions(payment_provider);
CREATE INDEX idx_transactions_adyen_psp_reference ON transactions(adyen_psp_reference);

-- Add comments for documentation
COMMENT ON COLUMN transactions.payment_provider IS 
'Payment processor used (stripe or adyen)';

COMMENT ON COLUMN transactions.adyen_psp_reference IS 
'Adyen PSP reference (equivalent of stripe_payment_intent_id for Adyen)';