-- Restaurer le prix original de la transaction "test litige partiel" qui a été incorrectement modifié
UPDATE public.transactions 
SET price = 400.00 
WHERE id = '835c0724-606b-48dd-9507-284d150e5458';