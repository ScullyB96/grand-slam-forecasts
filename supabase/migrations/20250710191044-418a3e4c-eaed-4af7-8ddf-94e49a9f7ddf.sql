-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule lineup monitoring every 15 minutes
SELECT cron.schedule(
  'lineup-monitoring-every-15-min',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/lineup-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM1NzUsImV4cCI6MjA2NzY4OTU3NX0.QA6JbLA-eGWCk_TewEUflLzQydIYdAJE4hFZTtMoBkw"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Also enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;