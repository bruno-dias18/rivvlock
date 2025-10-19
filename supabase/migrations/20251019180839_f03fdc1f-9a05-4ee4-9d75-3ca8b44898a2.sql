-- Ensure pgcrypto is available in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Fix token generator to reference extensions.gen_random_bytes explicitly
CREATE OR REPLACE FUNCTION public.generate_secure_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  raw_bytes bytea;
  token_base64 text;
BEGIN
  -- Generate 24 random bytes using the pgcrypto extension
  raw_bytes := extensions.gen_random_bytes(24);

  -- Base64 encode then convert to URL-safe base64 without padding
  token_base64 := encode(raw_bytes, 'base64');
  token_base64 := replace(replace(replace(token_base64, '/', '-'), '+', '_'), '=', '');

  RETURN token_base64;
END;
$function$;