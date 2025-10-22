-- Create webhook events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events
CREATE POLICY "Admins can view webhook events"
  ON public.webhook_events
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Cleanup old webhook events (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;