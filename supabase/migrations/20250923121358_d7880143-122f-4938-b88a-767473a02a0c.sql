-- First, check if stripe_accounts table exists, if not create it
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  account_status TEXT NOT NULL DEFAULT 'pending',
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  last_status_check TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for stripe_accounts table
CREATE POLICY "Users can view their own stripe account" 
ON public.stripe_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stripe account" 
ON public.stripe_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stripe account" 
ON public.stripe_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all stripe accounts" 
ON public.stripe_accounts 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all stripe accounts" 
ON public.stripe_accounts 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stripe_accounts_updated_at
BEFORE UPDATE ON public.stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();