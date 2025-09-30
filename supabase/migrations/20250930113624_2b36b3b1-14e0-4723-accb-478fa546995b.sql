-- Create dispute_proposals table
CREATE TABLE IF NOT EXISTS public.dispute_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL,
  proposal_type TEXT NOT NULL CHECK (proposal_type IN ('partial_refund', 'full_refund', 'no_refund')),
  refund_percentage NUMERIC CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dispute_proposals ENABLE ROW LEVEL SECURITY;

-- Users can view proposals from disputes they are involved in
CREATE POLICY "Users can view proposals from their disputes"
ON public.dispute_proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
    AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Users can create proposals in disputes they are involved in
CREATE POLICY "Users can create proposals in their disputes"
ON public.dispute_proposals
FOR INSERT
WITH CHECK (
  proposer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE d.id = dispute_proposals.dispute_id
    AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    AND d.status = 'open'
  )
);

-- Users can update proposals they created (only to mark as expired/rejected)
CREATE POLICY "Users can update their own proposals"
ON public.dispute_proposals
FOR UPDATE
USING (proposer_id = auth.uid())
WITH CHECK (proposer_id = auth.uid());

-- Admins can manage all proposals
CREATE POLICY "Admins can manage all proposals"
ON public.dispute_proposals
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_dispute_proposals_updated_at
  BEFORE UPDATE ON public.dispute_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_dispute_proposals_dispute_id ON public.dispute_proposals(dispute_id);
CREATE INDEX idx_dispute_proposals_status ON public.dispute_proposals(status);
CREATE INDEX idx_dispute_proposals_expires_at ON public.dispute_proposals(expires_at);