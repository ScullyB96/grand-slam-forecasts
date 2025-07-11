-- Set up cron jobs for automated Statcast data ingestion

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule nightly Statcast data ingestion at 2 AM ET (7 AM UTC)
SELECT cron.schedule(
  'nightly-statcast-ingestion',
  '0 7 * * *', -- Daily at 7 AM UTC (2 AM ET)
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/scheduled-statcast-ingestion',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule hourly game feed ingestion during active season
SELECT cron.schedule(
  'hourly-game-feed-ingestion',
  '0 * * * *', -- Every hour
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/ingest-game-feed',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);