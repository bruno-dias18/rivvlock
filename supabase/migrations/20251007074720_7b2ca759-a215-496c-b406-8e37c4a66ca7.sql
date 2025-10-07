-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create cron job for processing validation deadlines (every 10 minutes)
SELECT cron.schedule(
  'process-validation-deadline-job',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-validation-deadline',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for processing dispute deadlines (every 10 minutes)
SELECT cron.schedule(
  'process-dispute-deadlines-job',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-dispute-deadlines',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for processing expired payment deadlines (every 10 minutes)
SELECT cron.schedule(
  'process-expired-payment-deadlines-job',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-expired-payment-deadlines',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for sending validation reminders (every hour)
SELECT cron.schedule(
  'send-validation-reminders-job',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/send-validation-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);