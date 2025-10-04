-- Force unschedule ALL remaining jobs with hardcoded tokens in headers
-- This is a more aggressive approach to clean up the pg_cron jobs

DO $$
DECLARE 
  job_record RECORD;
BEGIN
  -- Unschedule all jobs that contain the anon key pattern in headers
  FOR job_record IN 
    SELECT jobid FROM cron.job 
    WHERE command LIKE '%eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Unscheduled job %', job_record.jobid;
  END LOOP;
END $$;