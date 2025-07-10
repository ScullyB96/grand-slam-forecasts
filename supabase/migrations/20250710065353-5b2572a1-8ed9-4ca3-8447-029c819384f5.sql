-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to monitor lineups every 15 minutes during game hours (9 AM to 11 PM ET)
SELECT cron.schedule(
  'lineup-monitor-15min',
  '*/15 9-23 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/lineup-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:='{"source": "cron", "time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Create a cron job to run lineup ingestion once daily at 8 AM ET to get projected lineups
SELECT cron.schedule(
  'lineup-ingestion-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/ingest-lineups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:='{"source": "cron", "time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);