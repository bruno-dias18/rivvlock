-- 1. Rendre client_email optionnel dans quotes
ALTER TABLE public.quotes 
ALTER COLUMN client_email DROP NOT NULL;

-- 2. Ajouter une RLS policy pour consultation anonyme du devis via token
CREATE POLICY "quotes_select_by_token"
ON public.quotes
FOR SELECT
TO anon
USING (
  secure_token IS NOT NULL 
  AND token_expires_at > now()
);

-- 3. Commentaire explicatif
COMMENT ON POLICY "quotes_select_by_token" ON public.quotes IS 
'Permet la consultation anonyme du devis via le secure_token (view_token) tant que non expiré';

-- 4. S'assurer que les conversations de type quote sont bien supportées
-- (déjà supporté dans la table conversations avec quote_id et conversation_type)

-- 5. Ajouter un index sur secure_token pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_quotes_secure_token 
ON public.quotes(secure_token) 
WHERE secure_token IS NOT NULL;