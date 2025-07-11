
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonteCarloResult {
  success: boolean;
  game_id: number;
  iterations: number;
  simulation_stats: {
    home_win_probability: number;
    away_win_probability: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_total_runs: number;
    over_probability: number;
    under_probability: number;
    over_under_line: number;
    confidence_score: number;
    sample_size: number;
  };
  factors: {
    park_factor: number;
    weather_impact: number;
    home_advantage: number;
    pitcher_fatigue: number;
  };
  timestamp: string;
}

serve(async (req) => {
  console.log('=== MONTE CARLO SIMULATION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json();
    const { game_id, iterations = 10000 } = requestBody;
    
    if (!game_id) {
      throw new Error('game_id is required');
    }

    console.log(`Running Monte Carlo simulation for game ${game_id} with ${iterations} iterations`);

    // Get game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('game_id', game_id)
      .single();

    if (gameError || !game) {
      throw new Error(`Game ${game_id} not found: ${gameError?.message}`);
    }

    // Get lineups with detailed player information
    const { data: lineups, error: lineupsError } = await supabase
      .from('game_lineups')
      .select('*')
      .eq('game_id', game_id);

    if (lineupsError) {
      throw new Error(`Failed to fetch lineups: ${lineupsError.message}`);
    }

    if (!lineups || lineups.length === 0) {
      throw new Error(`No lineups found for game ${game_id}`);
    }

    console.log(`Found ${lineups.length} lineup entries for game ${game_id}`);

    // Separate lineups by team and type
    const homeBatters = lineups.filter(p => p.team_id === game.home_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
    const awayBatters = lineups.filter(p => p.team_id === game.away_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
    const homeStartingPitcher = lineups.find(p => p.team_id === game.home_team_id && p.lineup_type === 'pitching' && p.is_starter);
    const awayStartingPitcher = lineups.find(p => p.team_id === game.away_team_id && p.lineup_type === 'pitching' && p.is_starter);

    console.log(`Home batters: ${homeBatters.length}, Away batters: ${awayBatters.length}`);
    console.log(`Home pitcher: ${homeStartingPitcher?.player_name}, Away pitcher: ${awayStartingPitcher?.player_name}`);

    if (homeBatters.length < 8 || awayBatters.length < 8) {
      throw new Error(`Insufficient lineup data - need at least 8 batters per team`);
    }

    // Get player stats for all batters
    const allBatterIds = [...homeBatters, ...awayBatters].map(p => p.player_id);
    const { data: batterStats, error: batterStatsError } = await supabase
      .from('batting_stats')
      .select('*')
      .in('player_id', allBatterIds)
      .eq('season', 2025);

    if (batterStatsError) {
      console.error('Error fetching batter stats:', batterStatsError);
    }

    // Get pitcher stats
    const pitcherIds = [homeStartingPitcher?.player_id, awayStartingPitcher?.player_id].filter(Boolean);
    const { data: pitcherStats, error: pitcherStatsError } = await supabase
      .from('pitching_stats')
      .select('*')
      .in('player_id', pitcherIds)
      .eq('season', 2025);

    if (pitcherStatsError) {
      console.error('Error fetching pitcher stats:', pitcherStatsError);
    }

    // Get park factors
    const { data: parkFactors, error: parkError } = await supabase
      .from('park_factors')
      .select('*')
      .eq('venue_name', game.venue_name)
      .eq('season', 2025)
      .maybeSingle();

    // Get weather data
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_data')
      .select('*')
      .eq('game_id', game_id)
      .maybeSingle();

    console.log(`Loaded stats: ${batterStats?.length || 0} batters, ${pitcherStats?.length || 0} pitchers`);

    // Run Monte Carlo simulation
    const simulationResult = await runMonteCarloSimulation({
      game,
      homeBatters,
      awayBatters,
      homeStartingPitcher,
      awayStartingPitcher,
      batterStats: batterStats || [],
      pitcherStats: pitcherStats || [],
      parkFactors,
      weatherData,
      iterations
    });

    // Create result object
    const result: MonteCarloResult = {
      success: true,
      game_id: game_id,
      iterations: iterations,
      simulation_stats: simulationResult.stats,
      factors: simulationResult.factors,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Monte Carlo simulation completed successfully');
    console.log('Results:', JSON.stringify(result.simulation_stats, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Monte Carlo simulation failed:', error);
    
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

async function runMonteCarloSimulation(params: any) {
  const { 
    game, 
    homeBatters, 
    awayBatters, 
    homeStartingPitcher, 
    awayStartingPitcher,
    batterStats,
    pitcherStats,
    parkFactors,
    weatherData,
    iterations 
  } = params;

  console.log(`🎲 Running ${iterations} Monte Carlo simulations...`);

  let homeWins = 0;
  let totalHomeRuns = 0;
  let totalAwayRuns = 0;
  let totalGames = 0;

  // Create lookup maps for faster access
  const batterStatsMap = new Map();
  batterStats.forEach((stats: any) => {
    batterStatsMap.set(stats.player_id, stats);
  });

  const pitcherStatsMap = new Map();
  pitcherStats.forEach((stats: any) => {
    pitcherStatsMap.set(stats.player_id, stats);
  });

  // Environmental factors
  const parkRunsFactor = parkFactors?.runs_factor || 1.0;
  const parkHRFactor = parkFactors?.hr_factor || 1.0;
  const weatherTemp = weatherData?.temperature_f || 72;
  const weatherWindSpeed = weatherData?.wind_speed_mph || 5;
  
  // Weather adjustments
  let weatherRunsMultiplier = 1.0;
  if (weatherTemp > 80) weatherRunsMultiplier += 0.02;
  if (weatherTemp < 60) weatherRunsMultiplier -= 0.02;
  if (weatherWindSpeed > 15) weatherRunsMultiplier += 0.01;

  const homeAdvantage = 1.03; // 3% home field advantage

  for (let i = 0; i < iterations; i++) {
    // Simulate home team offense vs away pitcher
    const homeRuns = simulateTeamOffense(
      homeBatters,
      awayStartingPitcher,
      batterStatsMap,
      pitcherStatsMap,
      parkRunsFactor,
      parkHRFactor,
      weatherRunsMultiplier * homeAdvantage
    );

    // Simulate away team offense vs home pitcher
    const awayRuns = simulateTeamOffense(
      awayBatters,
      homeStartingPitcher,
      batterStatsMap,
      pitcherStatsMap,
      parkRunsFactor,
      parkHRFactor,
      weatherRunsMultiplier
    );

    totalHomeRuns += homeRuns;
    totalAwayRuns += awayRuns;
    totalGames++;

    if (homeRuns > awayRuns) {
      homeWins++;
    }
  }

  const avgHomeScore = totalHomeRuns / totalGames;
  const avgAwayScore = totalAwayRuns / totalGames;
  const homeWinProbability = homeWins / totalGames;
  const awayWinProbability = 1 - homeWinProbability;
  const totalRuns = avgHomeScore + avgAwayScore;
  const overUnderLine = Math.round(totalRuns * 2) / 2; // Round to nearest 0.5

  // Calculate confidence based on data quality and sample size
  let confidence = 0.7; // Base confidence
  
  // Adjust for lineup completeness
  if (homeBatters.length >= 9 && awayBatters.length >= 9) confidence += 0.1;
  
  // Adjust for pitcher data availability
  if (homeStartingPitcher && awayStartingPitcher) confidence += 0.05;
  
  // Adjust for stats availability
  const batterStatsAvailable = homeBatters.filter(b => batterStatsMap.has(b.player_id)).length + 
                              awayBatters.filter(b => batterStatsMap.has(b.player_id)).length;
  const totalBatters = homeBatters.length + awayBatters.length;
  confidence += (batterStatsAvailable / totalBatters) * 0.1;

  const stats = {
    home_win_probability: Math.round(homeWinProbability * 1000) / 1000,
    away_win_probability: Math.round(awayWinProbability * 1000) / 1000,
    predicted_home_score: Math.round(avgHomeScore),
    predicted_away_score: Math.round(avgAwayScore),
    predicted_total_runs: Math.round(totalRuns * 10) / 10,
    over_probability: totalRuns > overUnderLine ? 0.55 : 0.45,
    under_probability: totalRuns > overUnderLine ? 0.45 : 0.55,
    over_under_line: overUnderLine,
    confidence_score: Math.round(confidence * 1000) / 1000,
    sample_size: iterations
  };

  const factors = {
    park_factor: parkRunsFactor,
    weather_impact: weatherRunsMultiplier,
    home_advantage: homeAdvantage,
    pitcher_fatigue: 1.0 // Placeholder for future enhancement
  };

  return { stats, factors };
}

function simulateTeamOffense(
  batters: any[],
  opposingPitcher: any,
  batterStatsMap: Map<number, any>,
  pitcherStatsMap: Map<number, any>,
  parkRunsFactor: number,
  parkHRFactor: number,
  weatherMultiplier: number
): number {
  let runs = 0;
  let baseRunners = 0; // Simplified base running simulation

  // Get opposing pitcher stats
  const pitcherStats = opposingPitcher ? pitcherStatsMap.get(opposingPitcher.player_id) : null;
  const pitcherERA = pitcherStats?.era || 4.50;
  const pitcherWHIP = pitcherStats?.whip || 1.30;
  
  // Pitcher effectiveness multiplier (lower ERA = harder to score against)
  const pitcherEffectiveness = Math.min(1.3, Math.max(0.7, pitcherERA / 4.50));

  for (const batter of batters) {
    const batterStats = batterStatsMap.get(batter.player_id);
    
    // Use stats if available, otherwise use positional defaults
    let battingAvg = 0.250;
    let onBasePercentage = 0.320;
    let sluggingPercentage = 0.400;
    
    if (batterStats && batterStats.at_bats > 50) { // Minimum AB threshold
      battingAvg = batterStats.avg || 0.250;
      onBasePercentage = batterStats.obp || 0.320;
      sluggingPercentage = batterStats.slg || 0.400;
    } else {
      // Position-based estimates if no stats
      const position = batter.position;
      if (['1B', 'DH'].includes(position)) {
        battingAvg = 0.270;
        onBasePercentage = 0.340;
        sluggingPercentage = 0.480;
      } else if (['C', 'SS'].includes(position)) {
        battingAvg = 0.240;
        onBasePercentage = 0.310;
        sluggingPercentage = 0.380;
      }
    }

    // Apply pitcher and environmental effects
    const adjustedOBP = onBasePercentage * (1 / pitcherEffectiveness) * weatherMultiplier;
    const adjustedSLG = sluggingPercentage * parkRunsFactor * weatherMultiplier;
    
    // Simulate plate appearance
    const randomValue = Math.random();
    
    if (randomValue < adjustedOBP * 0.8) { // On base event
      const extraBaseProbability = (adjustedSLG - battingAvg) / 3; // Simplified extra base calculation
      
      if (Math.random() < extraBaseProbability) {
        // Extra base hit - more likely to score runners and advance
        runs += Math.floor(baseRunners * 0.7) + (Math.random() < 0.3 ? 1 : 0); // Sometimes batter scores too
        baseRunners = Math.min(3, baseRunners + 1);
      } else {
        // Single - advance runners
        runs += Math.floor(baseRunners * 0.4);
        baseRunners = Math.min(3, baseRunners + 1);
      }
    } else if (randomValue < 0.70) { // Out - chance to advance runners
      if (baseRunners > 0 && Math.random() < 0.15) {
        runs += Math.random() < 0.3 ? 1 : 0; // Productive out
      }
    }
    
    // Home run check (separate calculation)
    const hrRate = batterStats?.home_runs || 0;
    const atBats = batterStats?.at_bats || 500;
    const baseHRRate = hrRate > 0 ? hrRate / atBats : 0.025;
    const adjustedHRRate = baseHRRate * parkHRFactor * weatherMultiplier;
    
    if (Math.random() < adjustedHRRate) {
      runs += baseRunners + 1; // All runners score plus batter
      baseRunners = 0;
    }
  }

  // Add remaining base runners with some probability
  runs += Math.floor(baseRunners * 0.25);

  return Math.max(0, Math.round(runs));
}
