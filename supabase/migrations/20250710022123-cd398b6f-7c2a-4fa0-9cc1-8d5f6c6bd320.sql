
-- Create tables for MLB data pipeline and predictions

-- Teams table
CREATE TABLE public.teams (
  id SERIAL PRIMARY KEY,
  team_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  league VARCHAR(10) NOT NULL,
  division VARCHAR(20) NOT NULL,
  venue_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE public.players (
  id SERIAL PRIMARY KEY,
  player_id INTEGER UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  position VARCHAR(20),
  team_id INTEGER REFERENCES teams(team_id),
  batting_hand VARCHAR(10),
  pitching_hand VARCHAR(10),
  birth_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE public.games (
  id SERIAL PRIMARY KEY,
  game_id INTEGER UNIQUE NOT NULL,
  game_date DATE NOT NULL,
  home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  venue_name VARCHAR(100),
  game_time TIME,
  status VARCHAR(20) DEFAULT 'scheduled',
  home_score INTEGER,
  away_score INTEGER,
  inning INTEGER,
  inning_half VARCHAR(10),
  weather_temp DECIMAL(5,2),
  weather_condition VARCHAR(50),
  wind_speed DECIMAL(5,2),
  wind_direction VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player stats table for batting
CREATE TABLE public.batting_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(player_id),
  season INTEGER NOT NULL,
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
  avg DECIMAL(4,3) DEFAULT 0.000,
  obp DECIMAL(4,3) DEFAULT 0.000,
  slg DECIMAL(4,3) DEFAULT 0.000,
  ops DECIMAL(4,3) DEFAULT 0.000,
  wrc_plus INTEGER DEFAULT 100,
  babip DECIMAL(4,3) DEFAULT 0.000,
  iso DECIMAL(4,3) DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, season)
);

-- Player stats table for pitching
CREATE TABLE public.pitching_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(player_id),
  season INTEGER NOT NULL,
  games INTEGER DEFAULT 0,
  games_started INTEGER DEFAULT 0,
  innings_pitched DECIMAL(5,1) DEFAULT 0.0,
  hits_allowed INTEGER DEFAULT 0,
  runs_allowed INTEGER DEFAULT 0,
  earned_runs INTEGER DEFAULT 0,
  home_runs_allowed INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  era DECIMAL(4,2) DEFAULT 0.00,
  whip DECIMAL(4,2) DEFAULT 0.00,
  k_9 DECIMAL(4,1) DEFAULT 0.0,
  bb_9 DECIMAL(4,1) DEFAULT 0.0,
  hr_9 DECIMAL(4,1) DEFAULT 0.0,
  fip DECIMAL(4,2) DEFAULT 0.00,
  xfip DECIMAL(4,2) DEFAULT 0.00,
  babip DECIMAL(4,3) DEFAULT 0.000,
  strand_rate DECIMAL(4,3) DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, season)
);

-- Park factors table
CREATE TABLE public.park_factors (
  id SERIAL PRIMARY KEY,
  venue_name VARCHAR(100) NOT NULL,
  season INTEGER NOT NULL,
  runs_factor DECIMAL(4,3) DEFAULT 1.000,
  hr_factor DECIMAL(4,3) DEFAULT 1.000,
  hits_factor DECIMAL(4,3) DEFAULT 1.000,
  walks_factor DECIMAL(4,3) DEFAULT 1.000,
  strikeouts_factor DECIMAL(4,3) DEFAULT 1.000,
  left_field_distance INTEGER,
  center_field_distance INTEGER,
  right_field_distance INTEGER,
  foul_territory_rating INTEGER DEFAULT 5,
  altitude INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(venue_name, season)
);

-- Team stats table
CREATE TABLE public.team_stats (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(team_id),
  season INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  runs_scored INTEGER DEFAULT 0,
  runs_allowed INTEGER DEFAULT 0,
  team_era DECIMAL(4,2) DEFAULT 0.00,
  team_whip DECIMAL(4,2) DEFAULT 0.00,
  team_avg DECIMAL(4,3) DEFAULT 0.000,
  team_obp DECIMAL(4,3) DEFAULT 0.000,
  team_slg DECIMAL(4,3) DEFAULT 0.000,
  bullpen_era DECIMAL(4,2) DEFAULT 0.00,
  bullpen_whip DECIMAL(4,2) DEFAULT 0.00,
  save_percentage DECIMAL(4,3) DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, season)
);

-- Game predictions table
CREATE TABLE public.game_predictions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  home_win_probability DECIMAL(5,4) NOT NULL,
  away_win_probability DECIMAL(5,4) NOT NULL,
  predicted_home_score DECIMAL(4,1),
  predicted_away_score DECIMAL(4,1),
  over_under_line DECIMAL(4,1),
  over_probability DECIMAL(5,4),
  under_probability DECIMAL(5,4),
  confidence_score DECIMAL(3,2),
  key_factors JSONB,
  model_version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, prediction_date::date)
);

-- Matchup insights table
CREATE TABLE public.matchup_insights (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  insight_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  impact_score DECIMAL(3,2), -- -1.0 to 1.0
  supporting_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ETL job tracking
CREATE TABLE public.etl_jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_teams ON games(home_team_id, away_team_id);
CREATE INDEX idx_batting_stats_player_season ON batting_stats(player_id, season);
CREATE INDEX idx_pitching_stats_player_season ON pitching_stats(player_id, season);
CREATE INDEX idx_park_factors_venue_season ON park_factors(venue_name, season);
CREATE INDEX idx_team_stats_team_season ON team_stats(team_id, season);
CREATE INDEX idx_predictions_game ON game_predictions(game_id);
CREATE INDEX idx_predictions_date ON game_predictions(prediction_date);
CREATE INDEX idx_etl_jobs_status ON etl_jobs(status, created_at);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitching_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.park_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etl_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since this is a public prediction site)
CREATE POLICY "Allow public read access to teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access to players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow public read access to games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Allow public read access to batting_stats" ON public.batting_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to pitching_stats" ON public.pitching_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to park_factors" ON public.park_factors FOR SELECT USING (true);
CREATE POLICY "Allow public read access to team_stats" ON public.team_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to game_predictions" ON public.game_predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to matchup_insights" ON public.matchup_insights FOR SELECT USING (true);

-- Admin policies for ETL operations (you'll need to authenticate for data updates)
CREATE POLICY "Allow authenticated users to manage etl_jobs" ON public.etl_jobs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.teams FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.games FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.batting_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.pitching_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.park_factors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.team_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.game_predictions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to insert/update all tables" ON public.matchup_insights FOR ALL USING (auth.role() = 'service_role');

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to all relevant tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batting_stats_updated_at BEFORE UPDATE ON batting_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pitching_stats_updated_at BEFORE UPDATE ON pitching_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_park_factors_updated_at BEFORE UPDATE ON park_factors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_stats_updated_at BEFORE UPDATE ON team_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
