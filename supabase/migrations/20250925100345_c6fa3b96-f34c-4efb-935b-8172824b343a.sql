-- Add fields for date modification functionality to transactions table
ALTER TABLE public.transactions 
ADD COLUMN proposed_service_date timestamp with time zone,
ADD COLUMN date_change_status text DEFAULT 'none' CHECK (date_change_status IN ('none', 'pending_approval', 'approved', 'rejected')),
ADD COLUMN date_change_requested_at timestamp with time zone,
ADD COLUMN date_change_message text,
ADD COLUMN date_change_count integer DEFAULT 0;

-- Create index for better query performance on date change status
CREATE INDEX idx_transactions_date_change_status ON public.transactions(date_change_status);