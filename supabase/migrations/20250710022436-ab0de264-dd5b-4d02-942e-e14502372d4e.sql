
-- Create teams table
CREATE TABLE public.teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  league TEXT NOT NULL CHECK (league IN ('AL', 'NL')),
  division TEXT NOT NULL CHECK (division IN ('East', 'Central', 'West')),
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create games table
CREATE TABLE public.games (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL UNIQUE,
  game_date DATE NOT NULL,
  game_time TIME,
  home_team_id INTEGER NOT NULL REFERENCES public.teams(id),
  away_team_id INTEGER NOT NULL REFERENCES public.teams(id),
  venue_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
  home_score INTEGER,
  away_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create game_predictions table
CREATE TABLE public.game_predictions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES public.games(game_id),
  home_win_probability DECIMAL(5,4) NOT NULL CHECK (home_win_probability >= 0 AND home_win_probability <= 1),
  away_win_probability DECIMAL(5,4) NOT NULL CHECK (away_win_probability >= 0 AND away_win_probability <= 1),
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  over_under_line DECIMAL(4,1),
  over_probability DECIMAL(5,4) CHECK (over_probability >= 0 AND over_probability <= 1),
  under_probability DECIMAL(5,4) CHECK (under_probability >= 0 AND under_probability <= 1),
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  key_factors JSONB,
  prediction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create team_stats table for additional team statistics
CREATE TABLE public.team_stats (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES public.teams(id),
  season INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  runs_scored INTEGER NOT NULL DEFAULT 0,
  runs_allowed INTEGER NOT NULL DEFAULT 0,
  team_era DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  team_avg DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  team_obp DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  team_slg DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, season)
);

-- Create indexes for better performance
CREATE INDEX idx_games_date ON public.games(game_date);
CREATE INDEX idx_games_home_team ON public.games(home_team_id);
CREATE INDEX idx_games_away_team ON public.games(away_team_id);
CREATE INDEX idx_predictions_game_id ON public.game_predictions(game_id);
CREATE INDEX idx_team_stats_team_season ON public.team_stats(team_id, season);

-- Enable Row Level Security (RLS) - these tables can be public for now since it's sports data
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_stats ENABLE ROW LEVEL SECURITY;

-- Create policies that allow public read access (since this is public sports data)
CREATE POLICY "Public read access for teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public read access for games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Public read access for predictions" ON public.game_predictions FOR SELECT USING (true);
CREATE POLICY "Public read access for team stats" ON public.team_stats FOR SELECT USING (true);
