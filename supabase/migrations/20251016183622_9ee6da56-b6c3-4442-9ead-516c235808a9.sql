-- Create conversation_reads table for server-side read status
CREATE TABLE public.conversation_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

-- Index for faster lookups
CREATE INDEX idx_conversation_reads_conversation_id ON public.conversation_reads(conversation_id);

-- Enable RLS
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only manage their own read status
CREATE POLICY "Users can view their own read status"
  ON public.conversation_reads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read status"
  ON public.conversation_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
  ON public.conversation_reads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin access
CREATE POLICY "Admins can view all read statuses"
  ON public.conversation_reads
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reads;