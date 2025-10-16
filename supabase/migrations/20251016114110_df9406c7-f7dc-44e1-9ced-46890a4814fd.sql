-- Add client_last_viewed_at to track when the client last viewed the quote
ALTER TABLE public.quotes
ADD COLUMN client_last_viewed_at timestamptz;