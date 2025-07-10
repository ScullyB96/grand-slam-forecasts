-- Create game lineups table to store actual lineups for each game
CREATE TABLE public.game_lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES public.games(game_id),
  team_id INTEGER NOT NULL REFERENCES public.teams(id),
  lineup_type TEXT NOT NULL CHECK (lineup_type IN ('batting', 'pitching')),
  batting_order INTEGER, -- 1-9 for batting lineup, NULL for pitchers
  position TEXT, -- C, 1B, 2B, etc. for position players, SP/RP for pitchers
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  handedness TEXT, -- L, R, S for switch hitters
  is_starter BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id, team_id, lineup_type, batting_order),
  UNIQUE(game_id, team_id, player_id)
);

-- Create indexes for fast lookups
CREATE INDEX idx_game_lineups_game_team ON public.game_lineups(game_id, team_id);
CREATE INDEX idx_game_lineups_player ON public.game_lineups(player_id);

-- Create batting splits table (vs LHP/RHP)
CREATE TABLE public.batting_splits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  team_id INTEGER,
  vs_handedness TEXT NOT NULL CHECK (vs_handedness IN ('L', 'R')), -- vs Left or Right handed pitching
  
  -- Core batting stats
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
  
  -- Calculated stats
  avg NUMERIC(5,3) DEFAULT 0.000,
  obp NUMERIC(5,3) DEFAULT 0.000,
  slg NUMERIC(5,3) DEFAULT 0.000,
  ops NUMERIC(5,3) DEFAULT 0.000,
  wrc_plus INTEGER DEFAULT 100,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(player_id, season, team_id, vs_handedness)
);

-- Create pitching splits table (home/away and vs LHB/RHB)
CREATE TABLE public.pitching_splits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  team_id INTEGER,
  split_type TEXT NOT NULL CHECK (split_type IN ('home', 'away', 'vs_L', 'vs_R')),
  
  -- Core pitching stats
  games INTEGER DEFAULT 0,
  games_started INTEGER DEFAULT 0,
  innings_pitched NUMERIC(4,1) DEFAULT 0.0,
  hits_allowed INTEGER DEFAULT 0,
  runs_allowed INTEGER DEFAULT 0,
  earned_runs INTEGER DEFAULT 0,
  home_runs_allowed INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  
  -- Calculated stats
  era NUMERIC(4,2) DEFAULT 0.00,
  whip NUMERIC(4,2) DEFAULT 0.00,
  k_9 NUMERIC(4,1) DEFAULT 0.0,
  bb_9 NUMERIC(4,1) DEFAULT 0.0,
  hr_9 NUMERIC(4,1) DEFAULT 0.0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(player_id, season, team_id, split_type)
);

-- Create indexes for splits tables
CREATE INDEX idx_batting_splits_player_season ON public.batting_splits(player_id, season);
CREATE INDEX idx_batting_splits_vs_handedness ON public.batting_splits(vs_handedness);
CREATE INDEX idx_pitching_splits_player_season ON public.pitching_splits(player_id, season);
CREATE INDEX idx_pitching_splits_type ON public.pitching_splits(split_type);

-- Enable RLS on new tables
ALTER TABLE public.game_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitching_splits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public read access for game_lineups" 
  ON public.game_lineups FOR SELECT USING (true);

CREATE POLICY "Service role can manage game_lineups" 
  ON public.game_lineups FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for batting_splits" 
  ON public.batting_splits FOR SELECT USING (true);

CREATE POLICY "Service role can manage batting_splits" 
  ON public.batting_splits FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for pitching_splits" 
  ON public.pitching_splits FOR SELECT USING (true);

CREATE POLICY "Service role can manage pitching_splits" 
  ON public.pitching_splits FOR ALL USING (auth.role() = 'service_role');

-- Add triggers for updated_at
CREATE TRIGGER update_game_lineups_updated_at
  BEFORE UPDATE ON public.game_lineups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batting_splits_updated_at
  BEFORE UPDATE ON public.batting_splits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pitching_splits_updated_at
  BEFORE UPDATE ON public.pitching_splits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();