-- Fix the teams table league constraint issue
ALTER TABLE teams ALTER COLUMN league DROP NOT NULL;

-- Check the data_ingestion_jobs status constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'data_ingestion_jobs'::regclass 
AND contype = 'c';

-- Fix common status values that might be missing
ALTER TABLE data_ingestion_jobs DROP CONSTRAINT IF EXISTS data_ingestion_jobs_status_check;
ALTER TABLE data_ingestion_jobs ADD CONSTRAINT data_ingestion_jobs_status_check 
CHECK (status IN ('pending', 'running', 'completed', 'failed', 'completed_with_errors', 'historical_backfill'));

-- Update the teams table to handle MLB API data better
UPDATE teams SET league = 'MLB' WHERE league IS NULL;
UPDATE teams SET division = 'Unknown' WHERE division IS NULL;