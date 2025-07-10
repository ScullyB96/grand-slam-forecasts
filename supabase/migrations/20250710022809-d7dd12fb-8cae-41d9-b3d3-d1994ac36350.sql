
-- Add missing columns to existing teams table to match MLB API data
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS team_id INTEGER,
ADD COLUMN IF NOT EXISTS venue_name TEXT;

-- Create unique constraint on team_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_team_id_key') THEN
        ALTER TABLE public.teams ADD CONSTRAINT teams_team_id_unique UNIQUE (team_id);
    END IF;
END $$;

-- Create players table for detailed player stats
CREATE TABLE IF NOT EXISTS public.players (
  id SERIAL PRIMARY KEY,
  player_id INTEGER UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  team_id INTEGER REFERENCES public.teams(id),
  batting_hand TEXT CHECK (batting_hand IN ('L', 'R', 'S')),
  pitching_hand TEXT CHECK (pitching_hand IN ('L', 'R')),
  birth_date DATE,
  height_inches INTEGER,
  weight_pounds INTEGER,
  jersey_number INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create batting stats table
CREATE TABLE IF NOT EXISTS public.batting_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES public.players(player_id),
  season INTEGER NOT NULL,
  team_id INTEGER REFERENCES public.teams(id),
  games_played INTEGER DEFAULT 0,
  at_bats INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  hits INTEGER DEFAULT 0,
  doubles INTEGER DEFAULT 0,
  triples INTEGER DEFAULT 0,
  home_runs INTEGER DEFAULT 0,
  rbi INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  stolen_bases INTEGER DEFAULT 0,
  caught_stealing INTEGER DEFAULT 0,
  hit_by_pitch INTEGER DEFAULT 0,
  sacrifice_hits INTEGER DEFAULT 0,
  sacrifice_flies INTEGER DEFAULT 0,
  avg DECIMAL(4,3) DEFAULT 0.000,
  obp DECIMAL(4,3) DEFAULT 0.000,
  slg DECIMAL(4,3) DEFAULT 0.000,
  ops DECIMAL(4,3) DEFAULT 0.000,
  wrc_plus INTEGER DEFAULT 100,
  babip DECIMAL(4,3) DEFAULT 0.000,
  iso DECIMAL(4,3) DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(player_id, season, team_id)
);

-- Create pitching stats table
CREATE TABLE IF NOT EXISTS public.pitching_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES public.players(player_id),
  season INTEGER NOT NULL,
  team_id INTEGER REFERENCES public.teams(id),
  games INTEGER DEFAULT 0,
  games_started INTEGER DEFAULT 0,
  complete_games INTEGER DEFAULT 0,
  shutouts INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  save_opportunities INTEGER DEFAULT 0,
  holds INTEGER DEFAULT 0,
  blown_saves INTEGER DEFAULT 0,
  innings_pitched DECIMAL(5,1) DEFAULT 0.0,
  hits_allowed INTEGER DEFAULT 0,
  runs_allowed INTEGER DEFAULT 0,
  earned_runs INTEGER DEFAULT 0,
  home_runs_allowed INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  intentional_walks INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  hit_batters INTEGER DEFAULT 0,
  wild_pitches INTEGER DEFAULT 0,
  era DECIMAL(4,2) DEFAULT 0.00,
  whip DECIMAL(4,2) DEFAULT 0.00,
  k_9 DECIMAL(4,1) DEFAULT 0.0,
  bb_9 DECIMAL(4,1) DEFAULT 0.0,
  hr_9 DECIMAL(4,1) DEFAULT 0.0,
  fip DECIMAL(4,2) DEFAULT 0.00,
  xfip DECIMAL(4,2) DEFAULT 0.00,
  babip DECIMAL(4,3) DEFAULT 0.000,
  strand_rate DECIMAL(4,3) DEFAULT 0.750,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(player_id, season, team_id)
);

-- Create park factors table
CREATE TABLE IF NOT EXISTS public.park_factors (
  id SERIAL PRIMARY KEY,
  venue_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  runs_factor DECIMAL(4,3) DEFAULT 1.000,
  hr_factor DECIMAL(4,3) DEFAULT 1.000,
  hits_factor DECIMAL(4,3) DEFAULT 1.000,
  walks_factor DECIMAL(4,3) DEFAULT 1.000,
  strikeouts_factor DECIMAL(4,3) DEFAULT 1.000,
  left_field_distance INTEGER,
  center_field_distance INTEGER,
  right_field_distance INTEGER,
  left_field_height INTEGER,
  center_field_height INTEGER,
  right_field_height INTEGER,
  foul_territory_rating INTEGER DEFAULT 5 CHECK (foul_territory_rating BETWEEN 1 AND 10),
  altitude INTEGER DEFAULT 0,
  surface TEXT DEFAULT 'Grass',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(venue_name, season)
);

-- Create weather data table
CREATE TABLE IF NOT EXISTS public.weather_data (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES public.games(game_id),
  temperature_f DECIMAL(5,2),
  humidity_percent INTEGER CHECK (humidity_percent BETWEEN 0 AND 100),
  wind_speed_mph DECIMAL(5,2),
  wind_direction_degrees INTEGER CHECK (wind_direction_degrees BETWEEN 0 AND 359),
  wind_direction TEXT,
  precipitation_inches DECIMAL(4,2) DEFAULT 0.00,
  condition TEXT,
  pressure_inches DECIMAL(5,2),
  visibility_miles DECIMAL(4,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id)
);

-- Create bullpen stats table
CREATE TABLE IF NOT EXISTS public.bullpen_stats (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES public.teams(id),
  season INTEGER NOT NULL,
  saves INTEGER DEFAULT 0,
  save_opportunities INTEGER DEFAULT 0,
  blown_saves INTEGER DEFAULT 0,
  holds INTEGER DEFAULT 0,
  save_percentage DECIMAL(5,3) DEFAULT 0.000,
  era DECIMAL(4,2) DEFAULT 0.00,
  whip DECIMAL(4,2) DEFAULT 0.00,
  k_9 DECIMAL(4,1) DEFAULT 0.0,
  bb_9 DECIMAL(4,1) DEFAULT 0.0,
  hr_9 DECIMAL(4,1) DEFAULT 0.0,
  avg_leverage_index DECIMAL(4,2) DEFAULT 1.00,
  win_probability_added DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, season)
);

-- Create trends table for tracking team performance trends
CREATE TABLE IF NOT EXISTS public.team_trends (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES public.teams(id),
  season INTEGER NOT NULL,
  last_10_wins INTEGER DEFAULT 0,
  last_10_losses INTEGER DEFAULT 0,
  last_30_wins INTEGER DEFAULT 0,
  last_30_losses INTEGER DEFAULT 0,
  home_wins INTEGER DEFAULT 0,
  home_losses INTEGER DEFAULT 0,
  away_wins INTEGER DEFAULT 0,
  away_losses INTEGER DEFAULT 0,
  vs_left_wins INTEGER DEFAULT 0,
  vs_left_losses INTEGER DEFAULT 0,
  vs_right_wins INTEGER DEFAULT 0,
  vs_right_losses INTEGER DEFAULT 0,
  day_game_wins INTEGER DEFAULT 0,
  day_game_losses INTEGER DEFAULT 0,
  night_game_wins INTEGER DEFAULT 0,
  night_game_losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, season)
);

-- Create ETL job tracking table
CREATE TABLE IF NOT EXISTS public.data_ingestion_jobs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  data_source TEXT,
  season INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_players_team_active ON public.players(team_id, active);
CREATE INDEX IF NOT EXISTS idx_players_position ON public.players(position) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_batting_stats_player_season ON public.batting_stats(player_id, season);
CREATE INDEX IF NOT EXISTS idx_batting_stats_season_team ON public.batting_stats(season, team_id);
CREATE INDEX IF NOT EXISTS idx_pitching_stats_player_season ON public.pitching_stats(player_id, season);
CREATE INDEX IF NOT EXISTS idx_pitching_stats_season_team ON public.pitching_stats(season, team_id);
CREATE INDEX IF NOT EXISTS idx_park_factors_venue_season ON public.park_factors(venue_name, season);
CREATE INDEX IF NOT EXISTS idx_weather_data_game ON public.weather_data(game_id);
CREATE INDEX IF NOT EXISTS idx_bullpen_stats_team_season ON public.bullpen_stats(team_id, season);
CREATE INDEX IF NOT EXISTS idx_team_trends_team_season ON public.team_trends(team_id, season);
CREATE INDEX IF NOT EXISTS idx_data_jobs_status_created ON public.data_ingestion_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_data_jobs_next_retry ON public.data_ingestion_jobs(next_retry_at) WHERE status = 'retrying';

-- Enable RLS on all new tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitching_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.park_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullpen_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Create public read policies for all tables
CREATE POLICY "Public read access for players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public read access for batting_stats" ON public.batting_stats FOR SELECT USING (true);
CREATE POLICY "Public read access for pitching_stats" ON public.pitching_stats FOR SELECT USING (true);
CREATE POLICY "Public read access for park_factors" ON public.park_factors FOR SELECT USING (true);
CREATE POLICY "Public read access for weather_data" ON public.weather_data FOR SELECT USING (true);
CREATE POLICY "Public read access for bullpen_stats" ON public.bullpen_stats FOR SELECT USING (true);
CREATE POLICY "Public read access for team_trends" ON public.team_trends FOR SELECT USING (true);
CREATE POLICY "Public read access for data_jobs" ON public.data_ingestion_jobs FOR SELECT USING (true);

-- Create service role policies for data ingestion
CREATE POLICY "Service role can manage players" ON public.players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage batting_stats" ON public.batting_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage pitching_stats" ON public.pitching_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage park_factors" ON public.park_factors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage weather_data" ON public.weather_data FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage bullpen_stats" ON public.bullpen_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage team_trends" ON public.team_trends FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage data_jobs" ON public.data_ingestion_jobs FOR ALL USING (auth.role() = 'service_role');

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to new tables
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batting_stats_updated_at BEFORE UPDATE ON public.batting_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pitching_stats_updated_at BEFORE UPDATE ON public.pitching_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_park_factors_updated_at BEFORE UPDATE ON public.park_factors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weather_data_updated_at BEFORE UPDATE ON public.weather_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bullpen_stats_updated_at BEFORE UPDATE ON public.bullpen_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_trends_updated_at BEFORE UPDATE ON public.team_trends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
