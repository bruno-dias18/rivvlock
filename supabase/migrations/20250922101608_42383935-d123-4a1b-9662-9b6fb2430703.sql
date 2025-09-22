-- Add CRON jobs for the validation deadline system

-- Schedule process-validation-deadline to run every hour
SELECT cron.schedule(
  'process-validation-deadline-hourly',
  '0 * * * *', -- Every hour at minute 0
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
  'send-validation-reminders-hourly',
  '0 * * * *', -- Every hour at minute 0  
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/send-validation-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Schedule activate-validation-deadlines to run every hour
SELECT cron.schedule(
  'activate-validation-deadlines-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/activate-validation-deadlines',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);