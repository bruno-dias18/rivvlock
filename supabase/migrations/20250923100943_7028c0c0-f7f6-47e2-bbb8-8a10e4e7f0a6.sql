-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('transaction_created', 'payment_received', 'transaction_validated', 'transaction_joined', 'profile_updated', 'payment_sync', 'dispute_created', 'funds_released')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_activity_logs_updated_at
BEFORE UPDATE ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_activity_logs_user_id_created_at ON public.activity_logs (user_id, created_at DESC);
CREATE INDEX idx_activity_logs_activity_type ON public.activity_logs (activity_type);

-- Insert some sample data for the current user
INSERT INTO public.activity_logs (user_id, activity_type, title, description, metadata)
SELECT 
  auth.uid(),
  'payment_sync',
  'Paiements synchronisés',
  'Synchronisation automatique avec Stripe effectuée',
  '{"sync_count": 7}'::jsonb
WHERE auth.uid() IS NOT NULL;