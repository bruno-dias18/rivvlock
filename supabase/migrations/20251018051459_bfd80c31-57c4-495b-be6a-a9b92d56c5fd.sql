-- Ajouter la colonne payment_method dans transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card';

-- Index pour optimiser les requêtes sur payment_method
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method 
ON transactions(payment_method);

-- Commentaire pour documentation
COMMENT ON COLUMN transactions.payment_method IS 'Method used for payment: card or bank_transfer';