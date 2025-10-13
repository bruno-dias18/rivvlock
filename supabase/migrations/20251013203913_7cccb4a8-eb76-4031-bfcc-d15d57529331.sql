-- Create admin_dispute_notes table with strict RLS
CREATE TABLE IF NOT EXISTS public.admin_dispute_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_dispute_notes ENABLE ROW LEVEL SECURITY;

-- Only super admins can read admin notes
CREATE POLICY "Only super admins can view admin notes"
ON public.admin_dispute_notes
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can create admin notes
CREATE POLICY "Only super admins can create admin notes"
ON public.admin_dispute_notes
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()) AND admin_user_id = auth.uid());

-- Only super admins can update admin notes
CREATE POLICY "Only super admins can update admin notes"
ON public.admin_dispute_notes
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Block all anonymous access
CREATE POLICY "Block anonymous access to admin notes"
ON public.admin_dispute_notes
FOR ALL
USING (false)
WITH CHECK (false);

-- Add trigger for updated_at
CREATE TRIGGER update_admin_dispute_notes_updated_at
BEFORE UPDATE ON public.admin_dispute_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove admin_notes from disputes table (if exists)
ALTER TABLE public.disputes DROP COLUMN IF EXISTS admin_notes;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_admin_dispute_notes_dispute_id ON public.admin_dispute_notes(dispute_id);
CREATE INDEX IF NOT EXISTS idx_admin_dispute_notes_admin_user_id ON public.admin_dispute_notes(admin_user_id);