-- Create data audit and model metadata tables
CREATE TABLE IF NOT EXISTS public.data_audit_results (
  id SERIAL PRIMARY KEY,
  audit_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  audit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  metrics JSONB,
  anomalies JSONB,
  error_details TEXT,
  completeness_score DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ml_model_metadata (
  id SERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  model_type TEXT NOT NULL,
  training_date TIMESTAMP WITH TIME ZONE NOT NULL,
  hyperparameters JSONB,
  training_metrics JSONB,
  validation_metrics JSONB,
  feature_importance JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_name, model_version)
);

CREATE TABLE IF NOT EXISTS public.prediction_performance (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES public.ml_model_metadata(id),
  game_id INTEGER REFERENCES public.games(game_id),
  predicted_home_win_prob DECIMAL(5,4),
  predicted_away_win_prob DECIMAL(5,4),
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  actual_winner TEXT,
  prediction_accuracy DECIMAL(5,4),
  score_mae DECIMAL(5,2),
  confidence_score DECIMAL(5,4),
  prediction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  game_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feature_engineering_cache (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL,
  game_date DATE NOT NULL,
  features JSONB NOT NULL,
  feature_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, game_date, feature_version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_audit_results_date ON public.data_audit_results(audit_date);
CREATE INDEX IF NOT EXISTS idx_data_audit_results_source ON public.data_audit_results(data_source, audit_date);
CREATE INDEX IF NOT EXISTS idx_ml_model_metadata_active ON public.ml_model_metadata(is_active, training_date);
CREATE INDEX IF NOT EXISTS idx_prediction_performance_game ON public.prediction_performance(game_id, prediction_date);
CREATE INDEX IF NOT EXISTS idx_feature_cache_team_date ON public.feature_engineering_cache(team_id, game_date);

-- Enable RLS
ALTER TABLE public.data_audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_engineering_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public read access for data_audit_results" ON public.data_audit_results FOR SELECT USING (true);
CREATE POLICY "Service role can manage data_audit_results" ON public.data_audit_results FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for ml_model_metadata" ON public.ml_model_metadata FOR SELECT USING (true);
CREATE POLICY "Service role can manage ml_model_metadata" ON public.ml_model_metadata FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for prediction_performance" ON public.prediction_performance FOR SELECT USING (true);
CREATE POLICY "Service role can manage prediction_performance" ON public.prediction_performance FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for feature_engineering_cache" ON public.feature_engineering_cache FOR SELECT USING (true);
CREATE POLICY "Service role can manage feature_engineering_cache" ON public.feature_engineering_cache FOR ALL USING (auth.role() = 'service_role');