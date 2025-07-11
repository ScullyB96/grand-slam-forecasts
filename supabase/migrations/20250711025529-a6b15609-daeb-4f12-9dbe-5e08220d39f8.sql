-- Set up pg_cron job to run master orchestrator daily
-- This will execute the master orchestrator function every day at 6 AM EST
SELECT cron.schedule(
  'daily-master-orchestrator',
  '0 11 * * *', -- 11 AM UTC = 6 AM EST
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiuvswmvoihqc.supabase.co/functions/v1/master-orchestrator',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:=concat('{"target_date": "', CURRENT_DATE, '", "force_refresh": false}')::jsonb
    ) as request_id;
  $$
);