-- Schedule GDPR data retention cleanup job
-- Runs on the 1st day of each month at 2:00 AM
SELECT cron.schedule(
  'gdpr-data-retention-cleanup-monthly',
  '0 2 1 * *',
  $$
  SELECT
    net.http_post(
        url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/gdpr-data-retention-cleanup',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);