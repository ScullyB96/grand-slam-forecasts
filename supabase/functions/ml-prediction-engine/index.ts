import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MLPredictionInput {
  game_id: number;
  home_team_features: any;
  away_team_features: any;
  park_factors: any;
  weather_data: any;
}

interface MLPredictionOutput {
  game_id: number;
  home_win_probability: number;
  away_win_probability: number;
  predicted_home_score: number;
  predicted_away_score: number;
  over_under_line: number;
  over_probability: number;
  under_probability: number;
  confidence_score: number;
  model_version: string;
  feature_importance: Record<string, number>;
  prediction_interval: {
    home_score_low: number;
    home_score_high: number;
    away_score_low: number;
    away_score_high: number;
  };
  key_factors: Record<string, any>;
}

// Simplified XGBoost-like model (in production, use actual XGBoost)
class SimpleGradientBoostingModel {
  private trees: any[] = [];
  private featureImportance: Record<string, number> = {};
  
  constructor() {
    // Initialize with pre-trained weights (mock)
    this.initializeModel();
  }
  
  private initializeModel() {
    // Mock feature importance from training
    this.featureImportance = {
      'home_win_percentage': 0.15,
      'away_win_percentage': 0.15,
      'home_recent_form_streak': 0.12,
      'away_recent_form_streak': 0.12,
      'home_runs_per_game': 0.10,
      'away_runs_allowed_per_game': 0.10,
      'home_bullpen_era': 0.08,
      'away_bullpen_era': 0.08,
      'park_runs_factor': 0.05,
      'weather_temperature': 0.03,
      'weather_wind_speed': 0.02
    };
    
    // Mock trained trees (in production, load from model file)
    this.trees = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      weight: 0.1,
      bias: Math.random() * 0.1 - 0.05
    }));
  }
  
  predict(features: Record<string, number>): {
    winProbability: number;
    scorePrediction: number;
    confidence: number;
  } {
    // Simplified gradient boosting prediction
    let prediction = 0.5; // Start with neutral
    let confidence = 0.7; // Base confidence
    
    // Apply feature-based adjustments
    const homeAdvantage = features['home_win_percentage'] || 0.5;
    const awayStrength = features['away_win_percentage'] || 0.5;
    const recentForm = (features['home_recent_form_streak'] || 0) / 10;
    const pitchingEdge = (features['home_bullpen_era'] || 4.5) - (features['away_bullpen_era'] || 4.5);
    
    // Calculate base probability
    prediction = (homeAdvantage * 0.4) + (0.54) + (recentForm * 0.1) - (pitchingEdge * 0.05);
    prediction = Math.max(0.1, Math.min(0.9, prediction));
    
    // Calculate expected runs
    const expectedRuns = 4.5 + (features['park_runs_factor'] || 1.0 - 1.0) * 2 + 
                        (features['weather_temperature'] > 80 ? 0.3 : features['weather_temperature'] < 60 ? -0.3 : 0);
    
    // Adjust confidence based on feature strength
    const featureStrength = Math.abs(homeAdvantage - 0.5) + Math.abs(recentForm) + Math.abs(pitchingEdge);
    confidence = Math.min(0.95, 0.6 + featureStrength);
    
    return {
      winProbability: prediction,
      scorePrediction: Math.max(0, expectedRuns),
      confidence: confidence
    };
  }
  
  getFeatureImportance(): Record<string, number> {
    return { ...this.featureImportance };
  }
}

serve(async (req) => {
  console.log('=== ADVANCED ML PREDICTION ENGINE ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { game_ids, model_version = '2.0.0', monte_carlo_simulations = 10000 } = requestBody;
    
    console.log(`Generating ML predictions for ${game_ids?.length || 'all'} games`);

    // Initialize models
    const winProbabilityModel = new SimpleGradientBoostingModel();
    const scorePredictionModel = new SimpleGradientBoostingModel();

    // Log prediction job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ML Prediction Generation',
        job_type: 'ml_prediction',
        data_source: `Model v${model_version}`,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobError) throw jobError;
    const jobId = jobRecord.id;

    // Get games to predict
    const games = await getGamesToPredict(supabase, game_ids);
    console.log(`Processing ${games.length} games`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const predictions: MLPredictionOutput[] = [];

    for (const game of games) {
      try {
        console.log(`🤖 Generating ML prediction for game ${game.game_id}`);
        
        // Check if prediction already exists and is recent
        const existingPrediction = await checkExistingMLPrediction(supabase, game.game_id, model_version);
        if (existingPrediction && !shouldUpdateMLPrediction(existingPrediction)) {
          console.log(`Skipping game ${game.game_id} - recent ML prediction exists`);
          continue;
        }

        // Get comprehensive input data
        const inputData = await gatherMLInputData(supabase, game);
        
        // Generate hybrid prediction (XGBoost + Monte Carlo)
        const prediction = await generateHybridPrediction(
          inputData,
          winProbabilityModel,
          scorePredictionModel,
          model_version,
          monte_carlo_simulations
        );

        // Save prediction with performance tracking
        await savePredictionWithTracking(supabase, prediction, jobId);
        
        predictions.push(prediction);
        processedCount++;
        console.log(`✅ ML prediction generated for game ${game.game_id}`);
        
      } catch (error) {
        console.error(`❌ Error processing game ${game.game_id}:`, error);
        errors.push(`Game ${game.game_id}: ${error.message}`);
        errorCount++;
      }
    }

    // Update job completion
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        records_processed: games.length,
        records_inserted: processedCount,
        errors_count: errorCount,
        error_details: errors.length > 0 ? { errors } : null
      })
      .eq('id', jobId);

    console.log(`🎯 ML prediction generation complete: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      model_version: model_version,
      predictions_generated: processedCount,
      errors: errorCount,
      predictions: predictions,
      feature_importance: winProbabilityModel.getFeatureImportance(),
      error_details: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ ML prediction generation failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getGamesToPredict(supabase: any, gameIds?: number[]): Promise<any[]> {
  let query = supabase
    .from('games')
    .select('game_id, home_team_id, away_team_id, venue_name, game_date, game_time')
    .eq('status', 'scheduled');

  if (gameIds && gameIds.length > 0) {
    query = query.in('game_id', gameIds);
  } else {
    // Get games for next 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    query = query
      .gte('game_date', new Date().toISOString().split('T')[0])
      .lte('game_date', nextWeek.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function checkExistingMLPrediction(supabase: any, gameId: number, modelVersion: string) {
  const { data } = await supabase
    .from('game_predictions')
    .select('last_updated, key_factors')
    .eq('game_id', gameId)
    .order('last_updated', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

function shouldUpdateMLPrediction(existingPrediction: any): boolean {
  if (!existingPrediction) return true;
  
  const predictionAge = Date.now() - new Date(existingPrediction.last_updated).getTime();
  const fourHoursInMs = 4 * 60 * 60 * 1000;
  
  return predictionAge > fourHoursInMs;
}

async function gatherMLInputData(supabase: any, game: any): Promise<MLPredictionInput> {
  console.log(`📊 Gathering ML input data for game ${game.game_id}`);
  
  // Get engineered features for both teams
  const [homeFeatures, awayFeatures, parkFactors, weatherData] = await Promise.all([
    getTeamFeatures(supabase, game.home_team_id, game.game_date),
    getTeamFeatures(supabase, game.away_team_id, game.game_date),
    getParkFactors(supabase, game.venue_name),
    getWeatherData(supabase, game.game_id)
  ]);

  return {
    game_id: game.game_id,
    home_team_features: homeFeatures,
    away_team_features: awayFeatures,
    park_factors: parkFactors,
    weather_data: weatherData
  };
}

async function getTeamFeatures(supabase: any, teamId: number, gameDate: string): Promise<any> {
  const { data, error } = await supabase
    .from('feature_engineering_cache')
    .select('features')
    .eq('team_id', teamId)
    .eq('game_date', gameDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Features not found for team ${teamId} on ${gameDate}. Run feature engineering first.`);
  }

  return data.features;
}

async function getParkFactors(supabase: any, venueName: string): Promise<any> {
  const { data, error } = await supabase
    .from('park_factors')
    .select('*')
    .eq('venue_name', venueName)
    .eq('season', new Date().getFullYear())
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Park factors not found for venue ${venueName}`);
  }

  return data;
}

async function getWeatherData(supabase: any, gameId: number): Promise<any> {
  const { data, error } = await supabase
    .from('weather_data')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Weather data not found for game ${gameId}`);
  }

  return data;
}

async function generateHybridPrediction(
  inputData: MLPredictionInput,
  winModel: SimpleGradientBoostingModel,
  scoreModel: SimpleGradientBoostingModel,
  modelVersion: string,
  monteCarloSims: number
): Promise<MLPredictionOutput> {
  
  console.log(`🧠 Generating hybrid prediction (XGBoost + Monte Carlo)`);
  
  // Prepare feature vector
  const features = prepareFeatureVector(inputData);
  
  // 1. GRADIENT BOOSTING PREDICTIONS
  const homeWinPrediction = winModel.predict({
    ...features,
    'home_win_percentage': inputData.home_team_features.win_percentage,
    'away_win_percentage': inputData.away_team_features.win_percentage,
    'home_recent_form_streak': inputData.home_team_features.recent_form_streak,
    'away_recent_form_streak': inputData.away_team_features.recent_form_streak,
    'home_runs_per_game': inputData.home_team_features.runs_per_game,
    'away_runs_allowed_per_game': inputData.away_team_features.runs_allowed_per_game,
    'home_bullpen_era': inputData.home_team_features.bullpen_era,
    'away_bullpen_era': inputData.away_team_features.bullpen_era,
    'park_runs_factor': inputData.park_factors.runs_factor,
    'weather_temperature': inputData.weather_data.temperature_f,
    'weather_wind_speed': inputData.weather_data.wind_speed_mph
  });

  const awayWinPrediction = winModel.predict({
    ...features,
    'home_win_percentage': inputData.away_team_features.win_percentage,
    'away_win_percentage': inputData.home_team_features.win_percentage,
    'home_recent_form_streak': inputData.away_team_features.recent_form_streak,
    'away_recent_form_streak': inputData.home_team_features.recent_form_streak,
    'home_runs_per_game': inputData.away_team_features.runs_per_game,
    'away_runs_allowed_per_game': inputData.home_team_features.runs_allowed_per_game,
    'home_bullpen_era': inputData.away_team_features.bullpen_era,
    'away_bullpen_era': inputData.home_team_features.bullpen_era,
    'park_runs_factor': inputData.park_factors.runs_factor,
    'weather_temperature': inputData.weather_data.temperature_f,
    'weather_wind_speed': inputData.weather_data.wind_speed_mph
  });

  // 2. MONTE CARLO SIMULATION FOR SCORE DISTRIBUTIONS
  const monteCarloResults = runMonteCarloSimulation(inputData, monteCarloSims);
  
  // 3. COMBINE RESULTS
  const homeWinProb = Math.round((homeWinPrediction.winProbability * 0.7 + monteCarloResults.homeWinRate * 0.3) * 1000) / 1000;
  const awayWinProb = Math.round((1 - homeWinProb) * 1000) / 1000;
  
  const predictedHomeScore = Math.round((homeWinPrediction.scorePrediction * 0.6 + monteCarloResults.avgHomeScore * 0.4));
  const predictedAwayScore = Math.round((awayWinPrediction.scorePrediction * 0.6 + monteCarloResults.avgAwayScore * 0.4));
  
  const totalRuns = predictedHomeScore + predictedAwayScore;
  const overUnderLine = Math.round(totalRuns * 2) / 2;
  
  // Calculate confidence score
  const confidence = Math.min(0.95, (homeWinPrediction.confidence + awayWinPrediction.confidence) / 2);
  
  // Key factors analysis
  const keyFactors = analyzeKeyFactors(inputData, homeWinProb);

  return {
    game_id: inputData.game_id,
    home_win_probability: homeWinProb,
    away_win_probability: awayWinProb,
    predicted_home_score: predictedHomeScore,
    predicted_away_score: predictedAwayScore,
    over_under_line: overUnderLine,
    over_probability: totalRuns > overUnderLine ? 0.52 : 0.48,
    under_probability: totalRuns > overUnderLine ? 0.48 : 0.52,
    confidence_score: confidence,
    model_version: modelVersion,
    feature_importance: winModel.getFeatureImportance(),
    prediction_interval: {
      home_score_low: Math.max(0, predictedHomeScore - 2),
      home_score_high: predictedHomeScore + 2,
      away_score_low: Math.max(0, predictedAwayScore - 2),
      away_score_high: predictedAwayScore + 2
    },
    key_factors: keyFactors
  };
}

function prepareFeatureVector(inputData: MLPredictionInput): Record<string, number> {
  // Transform categorical and complex features into numerical ones
  const features: Record<string, number> = {};
  
  // Weather features
  features['weather_temp_normalized'] = (inputData.weather_data.temperature_f - 70) / 20;
  features['weather_wind_factor'] = Math.min(1.5, inputData.weather_data.wind_speed_mph / 10);
  
  // Park features
  features['park_offense_boost'] = inputData.park_factors.runs_factor - 1.0;
  features['park_hr_boost'] = inputData.park_factors.hr_factor - 1.0;
  
  // Team strength differential
  features['win_pct_diff'] = inputData.home_team_features.win_percentage - inputData.away_team_features.win_percentage;
  features['recent_form_diff'] = inputData.home_team_features.recent_form_streak - inputData.away_team_features.recent_form_streak;
  
  return features;
}

function runMonteCarloSimulation(inputData: MLPredictionInput, simulations: number): any {
  let homeWins = 0;
  let totalHomeRuns = 0;
  let totalAwayRuns = 0;
  
  for (let i = 0; i < simulations; i++) {
    // Generate random game outcomes based on team strength
    const homeRunsBase = Math.max(0, normalRandom(inputData.home_team_features.runs_per_game, 1.5));
    const awayRunsBase = Math.max(0, normalRandom(inputData.away_team_features.runs_per_game, 1.5));
    
    // Apply park and weather factors
    const parkAdjustment = inputData.park_factors.runs_factor;
    const weatherAdjustment = getWeatherAdjustment(inputData.weather_data);
    
    const homeRuns = Math.round(homeRunsBase * parkAdjustment * weatherAdjustment * 1.03); // Home advantage
    const awayRuns = Math.round(awayRunsBase * parkAdjustment * weatherAdjustment);
    
    totalHomeRuns += homeRuns;
    totalAwayRuns += awayRuns;
    
    if (homeRuns > awayRuns) homeWins++;
  }
  
  return {
    homeWinRate: homeWins / simulations,
    avgHomeScore: totalHomeRuns / simulations,
    avgAwayScore: totalAwayRuns / simulations
  };
}

function getWeatherAdjustment(weather: any): number {
  let adjustment = 1.0;
  
  // Temperature effects
  if (weather.temperature_f > 85) adjustment += 0.03;
  if (weather.temperature_f < 55) adjustment -= 0.02;
  
  // Wind effects
  if (weather.wind_speed_mph > 15) {
    adjustment += weather.wind_direction === 'out' ? 0.05 : -0.02;
  }
  
  return adjustment;
}

function analyzeKeyFactors(inputData: MLPredictionInput, homeWinProb: number): Record<string, any> {
  const factors: Record<string, any> = {};
  
  // Team strength comparison
  factors.home_team_advantage = inputData.home_team_features.win_percentage > inputData.away_team_features.win_percentage;
  factors.recent_form_edge = inputData.home_team_features.recent_form_streak > inputData.away_team_features.recent_form_streak ? 'home' : 'away';
  factors.pitching_matchup = inputData.home_team_features.bullpen_era < inputData.away_team_features.bullpen_era ? 'home' : 'away';
  
  // Environmental factors
  factors.park_factor_impact = inputData.park_factors.runs_factor > 1.05 ? 'hitter_friendly' : 'pitcher_friendly';
  factors.weather_impact = `${inputData.weather_data.condition}, ${inputData.weather_data.temperature_f}°F`;
  
  // Confidence indicators
  factors.prediction_strength = homeWinProb > 0.6 || homeWinProb < 0.4 ? 'strong' : 'moderate';
  factors.data_quality = 'high'; // Based on successful data gathering
  
  return factors;
}

async function savePredictionWithTracking(supabase: any, prediction: MLPredictionOutput, jobId: number) {
  // Save the main prediction
  const { error: predError } = await supabase
    .from('game_predictions')
    .upsert({
      game_id: prediction.game_id,
      home_win_probability: prediction.home_win_probability,
      away_win_probability: prediction.away_win_probability,
      predicted_home_score: prediction.predicted_home_score,
      predicted_away_score: prediction.predicted_away_score,
      over_under_line: prediction.over_under_line,
      over_probability: prediction.over_probability,
      under_probability: prediction.under_probability,
      confidence_score: prediction.confidence_score,
      key_factors: prediction.key_factors,
      prediction_date: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'game_id',
      ignoreDuplicates: false
    });

  if (predError) throw predError;

  // Track prediction performance (for future model validation)
  const { error: perfError } = await supabase
    .from('prediction_performance')
    .insert({
      model_id: jobId, // Use job ID as model identifier for now
      game_id: prediction.game_id,
      predicted_home_win_prob: prediction.home_win_probability,
      predicted_away_win_prob: prediction.away_win_probability,
      predicted_home_score: prediction.predicted_home_score,
      predicted_away_score: prediction.predicted_away_score,
      confidence_score: prediction.confidence_score,
      prediction_date: new Date().toISOString(),
      game_date: new Date().toISOString().split('T')[0] // Will be updated with actual game date
    });

  if (perfError) console.warn('Failed to track prediction performance:', perfError);
}

// Utility function for normal distribution
function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}