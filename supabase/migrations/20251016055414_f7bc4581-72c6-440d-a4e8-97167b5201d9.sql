-- Add fee_ratio_client column to transactions table
ALTER TABLE transactions 
ADD COLUMN fee_ratio_client INTEGER DEFAULT 0;

COMMENT ON COLUMN transactions.fee_ratio_client IS 
'Pourcentage des frais de plateforme à charge du client (0-100). 0 = vendeur paie tout, 100 = client paie tout';
