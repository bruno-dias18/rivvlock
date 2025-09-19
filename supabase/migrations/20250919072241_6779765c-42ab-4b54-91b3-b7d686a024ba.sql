-- Ensure Realtime works for transactions table
-- 1) Set REPLICA IDENTITY FULL so UPDATEs include full row data
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.transactions REPLICA IDENTITY FULL';
EXCEPTION WHEN others THEN
  -- ignore if already set
  NULL;
END $$;

-- 2) Add transactions table to supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'transactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions';
  END IF;
END $$;