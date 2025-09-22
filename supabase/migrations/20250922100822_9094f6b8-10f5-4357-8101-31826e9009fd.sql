-- Create validation_reminders table to track sent reminders
CREATE TABLE public.validation_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '12h', '6h', '1h')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.validation_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for validation_reminders
CREATE POLICY "Users can view reminders for their transactions" 
ON public.validation_reminders 
FOR SELECT 
USING (transaction_id IN (
  SELECT id FROM transactions 
  WHERE user_id = auth.uid() OR buyer_id = auth.uid()
));

-- Create index for performance
CREATE INDEX idx_validation_reminders_transaction_id ON public.validation_reminders(transaction_id);
CREATE INDEX idx_validation_reminders_reminder_type ON public.validation_reminders(reminder_type);

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule process-validation-deadline to run every hour
SELECT cron.schedule(
  'process-validation-deadline',
  '0 * * * *', -- every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-validation-deadline',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Schedule send-validation-reminders to run every hour
SELECT cron.schedule(
  'send-validation-reminders',
  '0 * * * *', -- every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/send-validation-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);