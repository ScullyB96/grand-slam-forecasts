
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a daily cron job to run the master orchestrator at 6:00 AM EST
SELECT cron.schedule(
    'daily-mlb-data-orchestrator',
    '0 6 * * *', -- Daily at 6:00 AM EST
    $$
    SELECT
        net.http_post(
            url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/master-orchestrator',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjExMzU3NSwiZXhwIjoyMDY3Njg5NTc1fQ.l4A06mClsOOX0p3YnTF4JGiEa6gVBG2j1LWNxzKKPqo"}'::jsonb,
            body:='{"target_date": null, "force_refresh": false}'::jsonb
        ) as request_id;
    $$
);

-- Create a backup cron job to run at 2:00 PM EST in case morning run fails
SELECT cron.schedule(
    'backup-mlb-data-orchestrator',
    '0 14 * * *', -- Daily at 2:00 PM EST
    $$
    SELECT
        net.http_post(
            url:='https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/master-orchestrator',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmZ1c2dpcXZzd212aW9oaHFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjExMzU3NSwiZXhwIjoyMDY3Njg5NTc1fQ.l4A06mClsOOX0p3YnTF4JGiEa6gVBG2j1LWNxzKKPqo"}'::jsonb,
            body:='{"target_date": null, "force_refresh": true}'::jsonb
        ) as request_id;
    $$
);

-- Create a table to monitor cron job execution
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
    id SERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'started',
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for cron job logs
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to cron job logs
CREATE POLICY "Public read access for cron_job_logs" 
    ON public.cron_job_logs 
    FOR SELECT 
    USING (true);

-- Create policy for service role to manage cron job logs
CREATE POLICY "Service role can manage cron_job_logs" 
    ON public.cron_job_logs 
    FOR ALL 
    USING (auth.role() = 'service_role');
