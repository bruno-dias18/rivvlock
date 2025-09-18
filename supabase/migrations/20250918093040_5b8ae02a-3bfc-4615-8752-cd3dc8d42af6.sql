-- Add chat messages table for in-app communication
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages can be viewed by transaction participants
CREATE POLICY "Transaction participants can view messages" ON public.messages
FOR SELECT USING (
  transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE user_id = auth.uid() OR buyer_id = auth.uid()
  )
);

-- Transaction participants can create messages
CREATE POLICY "Transaction participants can create messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE user_id = auth.uid() OR buyer_id = auth.uid()
  )
);

-- Add disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  reporter_id uuid NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved_refund', 'resolved_release')),
  admin_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS for disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Disputes can be viewed by transaction participants
CREATE POLICY "Transaction participants can view disputes" ON public.disputes
FOR SELECT USING (
  transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE user_id = auth.uid() OR buyer_id = auth.uid()
  )
);

-- Only transaction participants can create disputes
CREATE POLICY "Transaction participants can create disputes" ON public.disputes
FOR INSERT WITH CHECK (
  auth.uid() = reporter_id AND
  transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE user_id = auth.uid() OR buyer_id = auth.uid()
  )
);

-- Add Stripe payment intent fields and validation status to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS seller_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS buyer_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validation_deadline timestamp with time zone,
ADD COLUMN IF NOT EXISTS funds_released boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.disputes(id);

-- Add updated_at trigger to disputes
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;