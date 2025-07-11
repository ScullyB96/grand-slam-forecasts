-- Create Statcast data tables for 2025 season

-- Player aggregated Statcast metrics table
CREATE TABLE public.player_statcast (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL DEFAULT 2025,
  team_id INTEGER,
  
  -- Batting Statcast metrics
  avg_exit_velocity NUMERIC(5,2),
  max_exit_velocity NUMERIC(5,2),
  avg_launch_angle NUMERIC(4,1),
  barrel_pct NUMERIC(4,1),
  hard_hit_pct NUMERIC(4,1),
  xba NUMERIC(4,3),
  xslg NUMERIC(4,3),
  xwoba NUMERIC(4,3),
  xobp NUMERIC(4,3),
  xops NUMERIC(4,3),
  sprint_speed NUMERIC(4,1),
  sweet_spot_pct NUMERIC(4,1),
  
  -- Pitching Statcast metrics
  avg_fastball_velocity NUMERIC(5,2),
  max_fastball_velocity NUMERIC(5,2),
  avg_spin_rate INTEGER,
  whiff_pct NUMERIC(4,1),
  chase_pct NUMERIC(4,1),
  extension NUMERIC(3,1),
  vertical_break NUMERIC(3,1),
  horizontal_break NUMERIC(3,1),
  
  -- Fielding metrics
  outs_above_average NUMERIC(4,1),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(player_id, season)
);

-- Pitch-by-pitch event log
CREATE TABLE public.pitch_log (
  id BIGSERIAL PRIMARY KEY,
  game_pk BIGINT NOT NULL,
  inning INTEGER NOT NULL,
  inning_half TEXT NOT NULL, -- 'top' or 'bottom'
  at_bat_index INTEGER NOT NULL,
  pitch_number INTEGER NOT NULL,
  
  pitcher_id INTEGER,
  batter_id INTEGER,
  
  -- Pitch data
  start_speed NUMERIC(4,1),
  end_speed NUMERIC(4,1),
  spin_rate INTEGER,
  spin_direction INTEGER,
  break_angle NUMERIC(4,1),
  break_length NUMERIC(3,1),
  zone INTEGER,
  type_confidence NUMERIC(4,3),
  plate_time NUMERIC(4,3),
  extension NUMERIC(3,1),
  
  -- Pitch coordinates
  px NUMERIC(5,3),
  pz NUMERIC(5,3),
  x0 NUMERIC(5,3),
  y0 NUMERIC(5,3),
  z0 NUMERIC(5,3),
  vx0 NUMERIC(6,3),
  vy0 NUMERIC(6,3),
  vz0 NUMERIC(6,3),
  ax NUMERIC(6,3),
  ay NUMERIC(6,3),
  az NUMERIC(6,3),
  
  pitch_type TEXT,
  pitch_name TEXT,
  description TEXT,
  result_type TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hit event log  
CREATE TABLE public.hit_log (
  id BIGSERIAL PRIMARY KEY,
  game_pk BIGINT NOT NULL,
  inning INTEGER NOT NULL,
  inning_half TEXT NOT NULL,
  at_bat_index INTEGER NOT NULL,
  
  batter_id INTEGER,
  pitcher_id INTEGER,
  
  -- Hit data
  launch_speed NUMERIC(5,2),
  launch_angle NUMERIC(4,1),
  total_distance NUMERIC(5,1),
  hit_distance_sc NUMERIC(5,1),
  
  -- Coordinates
  hc_x NUMERIC(6,2),
  hc_y NUMERIC(6,2),
  
  -- Result metrics
  is_barrel BOOLEAN DEFAULT FALSE,
  is_sweet_spot BOOLEAN DEFAULT FALSE,
  is_hard_hit BOOLEAN DEFAULT FALSE,
  
  trajectory TEXT,
  hit_location INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_player_statcast_player_season ON public.player_statcast(player_id, season);
CREATE INDEX idx_pitch_log_game_pk ON public.pitch_log(game_pk);
CREATE INDEX idx_pitch_log_pitcher ON public.pitch_log(pitcher_id);
CREATE INDEX idx_hit_log_game_pk ON public.hit_log(game_pk);
CREATE INDEX idx_hit_log_batter ON public.hit_log(batter_id);

-- Enable RLS
ALTER TABLE public.player_statcast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access for player_statcast" 
ON public.player_statcast FOR SELECT USING (true);

CREATE POLICY "Service role can manage player_statcast" 
ON public.player_statcast FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for pitch_log" 
ON public.pitch_log FOR SELECT USING (true);

CREATE POLICY "Service role can manage pitch_log" 
ON public.pitch_log FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for hit_log" 
ON public.hit_log FOR SELECT USING (true);

CREATE POLICY "Service role can manage hit_log" 
ON public.hit_log FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_player_statcast_updated_at
  BEFORE UPDATE ON public.player_statcast
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();