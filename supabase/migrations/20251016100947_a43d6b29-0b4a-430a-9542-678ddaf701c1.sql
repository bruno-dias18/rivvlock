-- Activer REPLICA IDENTITY FULL pour capturer toutes les données lors des changements
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Ajouter la table à la publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;