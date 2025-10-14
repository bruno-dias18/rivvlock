-- Create table to track dispute message read status across devices
CREATE TABLE IF NOT EXISTS public.dispute_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, dispute_id)
);

-- Enable RLS
ALTER TABLE public.dispute_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own read status
CREATE POLICY "Users can view their own dispute read status"
ON public.dispute_message_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own read status
CREATE POLICY "Users can insert their own dispute read status"
ON public.dispute_message_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own read status
CREATE POLICY "Users can update their own dispute read status"
ON public.dispute_message_reads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Admins can view all read statuses
CREATE POLICY "Admins can view all dispute read statuses"
ON public.dispute_message_reads
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policy: Block anonymous access
CREATE POLICY "Block anonymous access to dispute read statuses"
ON public.dispute_message_reads
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Create indexes for performance
CREATE INDEX idx_dispute_message_reads_user_dispute 
ON public.dispute_message_reads(user_id, dispute_id);

CREATE INDEX idx_dispute_message_reads_last_seen 
ON public.dispute_message_reads(last_seen_at);

CREATE INDEX idx_dispute_message_reads_user_id 
ON public.dispute_message_reads(user_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_dispute_message_reads_updated_at
BEFORE UPDATE ON public.dispute_message_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();