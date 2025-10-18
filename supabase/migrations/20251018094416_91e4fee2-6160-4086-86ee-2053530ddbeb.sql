-- Modifier la fonction generate_secure_token() pour produire des tokens URL-safe
CREATE OR REPLACE FUNCTION public.generate_secure_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Utilise base64url au lieu de base64 standard
  -- Remplace / par -, + par _, et retire les =
  RETURN REPLACE(REPLACE(REPLACE(
    encode(gen_random_bytes(24), 'base64'),
    '/', '-'),
    '+', '_'),
    '=', '');
END;
$function$;

-- Mettre à jour la valeur par défaut de secure_token dans la table quotes
ALTER TABLE quotes 
ALTER COLUMN secure_token 
SET DEFAULT REPLACE(REPLACE(REPLACE(
  encode(gen_random_bytes(24), 'base64'),
  '/', '-'),
  '+', '_'),
  '=', '');

-- Nettoyer tous les tokens existants pour les rendre URL-safe
UPDATE quotes
SET secure_token = REPLACE(REPLACE(REPLACE(secure_token, '/', '-'), '+', '_'), '=', '')
WHERE secure_token ~ '[/+=]';