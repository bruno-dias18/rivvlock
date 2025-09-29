-- Create the dispute_status enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.dispute_status AS ENUM ('open', 'responded', 'resolved', 'negotiating', 'escalated', 'resolved_refund', 'resolved_release');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Remove the default constraint temporarily to allow type conversion
ALTER TABLE public.disputes ALTER COLUMN status DROP DEFAULT;

-- Update disputes table to use the enum type  
ALTER TABLE public.disputes 
ALTER COLUMN status TYPE public.dispute_status USING status::public.dispute_status;

-- Set the new default value
ALTER TABLE public.disputes ALTER COLUMN status SET DEFAULT 'open'::public.dispute_status;

-- Add dispute_deadline column to disputes table
ALTER TABLE public.disputes 
ADD COLUMN IF NOT EXISTS dispute_deadline timestamp with time zone,
ADD COLUMN IF NOT EXISTS escalated_at timestamp with time zone;

-- Update existing disputes to have a 48h deadline from creation
UPDATE public.disputes 
SET dispute_deadline = created_at + interval '48 hours'
WHERE dispute_deadline IS NULL;

-- Create dispute_messages table for integrated messaging
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on dispute_messages
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for dispute_messages (only create if they don't exist)
DO $$ BEGIN
    CREATE POLICY "Users can view messages from disputes they are involved in"
    ON public.dispute_messages
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON d.transaction_id = t.id
        WHERE d.id = dispute_messages.dispute_id
        AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
      )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create messages in disputes they are involved in"
    ON public.dispute_messages
    FOR INSERT
    WITH CHECK (
      sender_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON d.transaction_id = t.id
        WHERE d.id = dispute_messages.dispute_id
        AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
      )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage all dispute messages"
    ON public.dispute_messages
    FOR ALL
    USING (is_admin(auth.uid()));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance on dispute messages
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON public.dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON public.dispute_messages(created_at);