-- Clean up stuck jobs
UPDATE data_ingestion_jobs 
SET status = 'failed', 
    completed_at = now(),
    error_details = '{"error": "Job timed out"}'::jsonb
WHERE status = 'running' AND created_at < now() - interval '5 minutes';