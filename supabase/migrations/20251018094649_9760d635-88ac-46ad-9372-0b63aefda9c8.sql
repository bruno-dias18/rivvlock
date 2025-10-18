-- Mettre à jour la valeur par défaut de shared_link_token pour les transactions
ALTER TABLE transactions 
ALTER COLUMN shared_link_token 
SET DEFAULT REPLACE(REPLACE(REPLACE(
  encode(gen_random_bytes(24), 'base64'),
  '/', '-'),
  '+', '_'),
  '=', '');

-- Optionnel : nettoyer les tokens existants (si tu veux des tokens plus courts)
-- Note: les tokens uuid-uuid actuels fonctionnent déjà, cette étape est pour uniformiser le format uniquement
-- UPDATE transactions 
-- SET shared_link_token = REPLACE(REPLACE(REPLACE(encode(gen_random_bytes(24), 'base64'), '/', '-'), '+', '_'), '=', '')
-- WHERE shared_link_token IS NOT NULL;