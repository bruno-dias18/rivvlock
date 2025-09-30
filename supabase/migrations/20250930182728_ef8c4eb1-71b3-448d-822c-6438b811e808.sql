-- Add fields for admin official proposals to dispute_proposals table
ALTER TABLE public.dispute_proposals
ADD COLUMN IF NOT EXISTS requires_both_parties boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS buyer_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS seller_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_created boolean DEFAULT false;

-- Create index for filtering admin official proposals
CREATE INDEX IF NOT EXISTS idx_dispute_proposals_admin_created 
ON public.dispute_proposals(admin_created) 
WHERE admin_created = true;