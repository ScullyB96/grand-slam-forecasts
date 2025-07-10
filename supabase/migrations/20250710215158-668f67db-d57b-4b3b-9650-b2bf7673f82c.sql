
-- Create lineups table for storing daily MLB lineups
CREATE TABLE public.lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_pk BIGINT NOT NULL,
  team_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  batting_order INTEGER,
  position_code TEXT,
  player_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_pk, player_id)
);

-- Add Row Level Security
ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public read access for lineups" 
  ON public.lineups 
  FOR SELECT 
  USING (true);

-- Create policy for service role to manage lineups
CREATE POLICY "Service role can manage lineups" 
  ON public.lineups 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lineups_date ON public.lineups(date);
CREATE INDEX IF NOT EXISTS idx_lineups_game_pk ON public.lineups(game_pk);
CREATE INDEX IF NOT EXISTS idx_lineups_team_id ON public.lineups(team_id);

-- Enable pg_cron extension for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to track lineup ingestion jobs
CREATE TABLE public.lineup_ingestion_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  games_expected INTEGER DEFAULT 0,
  games_processed INTEGER DEFAULT 0,
  games_failed INTEGER DEFAULT 0,
  failed_games JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_details TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security for lineup_ingestion_jobs
ALTER TABLE public.lineup_ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to job status
CREATE POLICY "Public read access for lineup_ingestion_jobs" 
  ON public.lineup_ingestion_jobs 
  FOR SELECT 
  USING (true);

-- Create policy for service role to manage jobs
CREATE POLICY "Service role can manage lineup_ingestion_jobs" 
  ON public.lineup_ingestion_jobs 
  FOR ALL 
  USING (auth.role() = 'service_role');
