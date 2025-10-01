-- Create message_reads table to track which messages have been read by which users
CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.transaction_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate reads
CREATE UNIQUE INDEX idx_message_reads_unique ON public.message_reads(message_id, user_id);

-- Create index for performance on user queries
CREATE INDEX idx_message_reads_user_id ON public.message_reads(user_id);

-- Enable Row Level Security
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view their own read status"
ON public.message_reads
FOR SELECT
USING (auth.uid() = user_id);

-- Users can mark messages as read
CREATE POLICY "Users can mark messages as read"
ON public.message_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.transaction_messages tm
    JOIN public.transactions t ON t.id = tm.transaction_id
    WHERE tm.id = message_reads.message_id
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Admins can manage all read statuses
CREATE POLICY "Admins can manage all read statuses"
ON public.message_reads
FOR ALL
USING (is_admin(auth.uid()));

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;