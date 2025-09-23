-- Create disputes table for handling transaction disputes
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL,
  reporter_id UUID NOT NULL,
  dispute_type TEXT NOT NULL DEFAULT 'quality_issue',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on disputes table
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Create policies for disputes
CREATE POLICY "Users can view disputes they are involved in"
ON public.disputes
FOR SELECT
USING (
  reporter_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = disputes.transaction_id 
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

CREATE POLICY "Users can create disputes for their transactions"
ON public.disputes
FOR INSERT
WITH CHECK (
  reporter_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = disputes.transaction_id 
    AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    AND t.status = 'paid'
  )
);

CREATE POLICY "Admins can manage all disputes"
ON public.disputes
FOR ALL
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();