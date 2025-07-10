
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GameData {
  game_id: number;
  home_team_id: number;
  away_team_id: number;
  venue_name: string;
  game_date: string;
}

interface TeamStats {
  wins: number;
  losses: number;
  runs_scored: number;
  runs_allowed: number;
  team_era: number;
  team_avg: number;
  team_obp: number;
  team_slg: number;
}

interface ParkFactors {
  runs_factor: number;
  hr_factor: number;
  hits_factor: number;
}

interface WeatherData {
  temperature_f: number;
  wind_speed_mph: number;
  wind_direction: string;
  condition: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Generate predictions function called');
    const requestBody = await req.json().catch(() => ({}));
    console.log('Request body:', requestBody);
    
    const { game_ids } = requestBody;
    
    // Log job start
    console.log('Starting prediction generation job');
    const jobId = await logJobStart(supabase, 'generate-predictions', game_ids);

    // Get games to predict
    console.log('Fetching games to predict...');
    const games = await getGamesToPredict(supabase, game_ids);
    console.log(`Processing ${games.length} games`);

    if (games.length === 0) {
      console.log('No games found to predict');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No games found to predict',
          processed: 0, 
          errors: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const game of games) {
      try {
        console.log(`Processing game ${game.game_id}`);
        
        // Check if prediction already exists (idempotency)
        const existingPrediction = await checkExistingPrediction(supabase, game.game_id);
        if (existingPrediction && !shouldUpdatePrediction(existingPrediction)) {
          console.log(`Skipping game ${game.game_id} - recent prediction exists`);
          continue;
        }

        // Gather all data needed for prediction
        console.log(`Gathering data for game ${game.game_id}`);
        const [homeStats, awayStats, parkFactors, weather] = await Promise.all([
          getTeamStats(supabase, game.home_team_id),
          getTeamStats(supabase, game.away_team_id),
          getParkFactors(supabase, game.venue_name),
          getWeatherData(supabase, game.game_id)
        ]);

        // Generate prediction using Monte Carlo simulation
        console.log(`Generating prediction for game ${game.game_id}`);
        const prediction = await generatePrediction(game, homeStats, awayStats, parkFactors, weather);

        // Upsert prediction to database
        console.log(`Saving prediction for game ${game.game_id}`);
        await upsertPrediction(supabase, prediction);
        
        processedCount++;
        console.log(`Generated prediction for game ${game.game_id}`);
        
      } catch (error) {
        console.error(`Error processing game ${game.game_id}:`, error);
        errorCount++;
      }
    }

    // Log job completion
    await logJobCompletion(supabase, jobId, processedCount, errorCount);

    console.log(`Prediction generation complete: ${processedCount} processed, ${errorCount} errors`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        errors: errorCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-predictions function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        processed: 0,
        errors: 1
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function logJobStart(supabase: any, jobName: string, gameIds?: number[]) {
  const { data, error } = await supabase
    .from('data_ingestion_jobs')
    .insert({
      job_name: jobName,
      job_type: 'prediction',
      status: 'running',
      started_at: new Date().toISOString(),
      data_source: gameIds ? `games: ${gameIds.join(',')}` : 'all_scheduled'
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating prediction job:', error);
    throw error;
  }
  console.log('Created prediction job with ID:', data.id);
  return data.id;
}

async function logJobCompletion(supabase: any, jobId: number, processed: number, errors: number) {
  await supabase
    .from('data_ingestion_jobs')
    .update({
      status: errors > 0 ? 'completed_with_errors' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: processed,
      errors_count: errors
    })
    .eq('id', jobId);
}

async function getGamesToPredict(supabase: any, gameIds?: number[]): Promise<GameData[]> {
  let query = supabase
    .from('games')
    .select('game_id, home_team_id, away_team_id, venue_name, game_date')
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

async function checkExistingPrediction(supabase: any, gameId: number) {
  const { data } = await supabase
    .from('game_predictions')
    .select('prediction_date')
    .eq('game_id', gameId)
    .order('prediction_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

function shouldUpdatePrediction(existingPrediction: any): boolean {
  if (!existingPrediction) return true;
  
  const predictionAge = Date.now() - new Date(existingPrediction.prediction_date).getTime();
  const sixHoursInMs = 6 * 60 * 60 * 1000;
  
  return predictionAge > sixHoursInMs;
}

async function getTeamStats(supabase: any, teamId: number): Promise<TeamStats> {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', new Date().getFullYear())
    .single();

  if (error || !data) {
    // Return default stats if not found
    return {
      wins: 50, losses: 50, runs_scored: 500, runs_allowed: 500,
      team_era: 4.50, team_avg: 0.250, team_obp: 0.320, team_slg: 0.400
    };
  }

  return data;
}

async function getParkFactors(supabase: any, venueName: string): Promise<ParkFactors> {
  const { data } = await supabase
    .from('park_factors')
    .select('runs_factor, hr_factor, hits_factor')
    .eq('venue_name', venueName)
    .eq('season', new Date().getFullYear())
    .maybeSingle();

  return data || { runs_factor: 1.0, hr_factor: 1.0, hits_factor: 1.0 };
}

async function getWeatherData(supabase: any, gameId: number): Promise<WeatherData | null> {
  const { data } = await supabase
    .from('weather_data')
    .select('temperature_f, wind_speed_mph, wind_direction, condition')
    .eq('game_id', gameId)
    .maybeSingle();

  return data;
}

async function generatePrediction(
  game: GameData,
  homeStats: TeamStats,
  awayStats: TeamStats,
  parkFactors: ParkFactors,
  weather: WeatherData | null
) {
  // Monte Carlo simulation parameters
  const simulations = 10000;
  let homeWins = 0;
  let totalHomeRuns = 0;
  let totalAwayRuns = 0;

  // Calculate base win probabilities using logistic regression approach
  const homeAdvantage = 0.54; // Historical home field advantage
  const homePythag = homeStats.runs_scored ** 2 / (homeStats.runs_scored ** 2 + homeStats.runs_allowed ** 2);
  const awayPythag = awayStats.runs_scored ** 2 / (awayStats.runs_scored ** 2 + awayStats.runs_allowed ** 2);
  
  // Adjust for park factors and weather
  let parkAdjustment = 1.0;
  if (parkFactors) {
    parkAdjustment = (parkFactors.runs_factor + parkFactors.hr_factor) / 2;
  }
  
  let weatherAdjustment = 1.0;
  if (weather) {
    // Wind affects home runs, temperature affects ball flight
    if (weather.wind_direction === 'out' || weather.wind_speed_mph > 15) {
      weatherAdjustment += 0.05;
    }
    if (weather.temperature_f < 50) {
      weatherAdjustment -= 0.03;
    }
  }

  // Run Monte Carlo simulation
  for (let i = 0; i < simulations; i++) {
    // Generate random outcomes based on team stats
    const homeRunsBase = Math.max(0, normalRandom(homeStats.runs_scored / 162, 2));
    const awayRunsBase = Math.max(0, normalRandom(awayStats.runs_scored / 162, 2));
    
    const homeRuns = Math.round(homeRunsBase * parkAdjustment * weatherAdjustment * homeAdvantage);
    const awayRuns = Math.round(awayRunsBase * parkAdjustment * weatherAdjustment);
    
    totalHomeRuns += homeRuns;
    totalAwayRuns += awayRuns;
    
    if (homeRuns > awayRuns) {
      homeWins++;
    }
  }

  const avgHomeScore = Math.round((totalHomeRuns / simulations) * 10) / 10;
  const avgAwayScore = Math.round((totalAwayRuns / simulations) * 10) / 10;
  const homeWinProb = Math.round((homeWins / simulations) * 1000) / 1000;
  const awayWinProb = Math.round((1 - homeWinProb) * 1000) / 1000;
  
  const totalRuns = avgHomeScore + avgAwayScore;
  const overUnderLine = Math.round(totalRuns * 2) / 2; // Round to nearest 0.5

  // Calculate confidence based on team record differential
  const recordDiff = Math.abs((homeStats.wins - homeStats.losses) - (awayStats.wins - awayStats.losses));
  const confidence = Math.min(0.95, 0.5 + (recordDiff / 100));

  // Generate key factors
  const keyFactors = {
    home_advantage: homeAdvantage > 0.52,
    pitching_matchup: homeStats.team_era < awayStats.team_era ? 'home' : 'away',
    offensive_edge: homeStats.runs_scored > awayStats.runs_scored ? 'home' : 'away',
    park_factors: parkFactors.runs_factor > 1.05 ? 'hitter_friendly' : 
                  parkFactors.runs_factor < 0.95 ? 'pitcher_friendly' : 'neutral',
    weather_impact: weather ? `${weather.condition}, ${weather.temperature_f}°F` : null
  };

  return {
    game_id: game.game_id,
    home_win_probability: homeWinProb,
    away_win_probability: awayWinProb,
    predicted_home_score: Math.round(avgHomeScore),
    predicted_away_score: Math.round(avgAwayScore),
    over_under_line: overUnderLine,
    over_probability: totalRuns > overUnderLine ? 0.52 : 0.48,
    under_probability: totalRuns > overUnderLine ? 0.48 : 0.52,
    confidence_score: confidence,
    key_factors: keyFactors,
    prediction_date: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
}

async function upsertPrediction(supabase: any, prediction: any) {
  const { error } = await supabase
    .from('game_predictions')
    .upsert(prediction, { 
      onConflict: 'game_id',
      ignoreDuplicates: false 
    });

  if (error) throw error;
}

// Utility function for normal distribution random numbers
function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}
