
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
    data_quality: number;
  };
  key_insights: {
    pitching_matchup: string;
    offensive_edge: string;
    environmental_impact: string;
    confidence_drivers: string[];
  };
  timestamp: string;
}

serve(async (req) => {
  console.log('=== MONTE CARLO SIMULATION V2.0 STARTED ===');
  
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

    console.log(`🎲 Running advanced Monte Carlo simulation for game ${game_id} with ${iterations} iterations`);

    // Get feature set from feature engineering function
    console.log('📊 Fetching feature set...');
    const { data: featureResponse, error: featureError } = await supabase.functions.invoke('feature-engineering', {
      body: { game_id, force_refresh: false }
    });

    if (featureError || !featureResponse?.success) {
      throw new Error(`Failed to get feature set: ${featureError?.message || 'Feature engineering failed'}`);
    }

    const features = featureResponse.features;
    console.log(`✅ Feature set loaded with ${Math.round(features.metadata.data_completeness.overall_score * 100)}% data completeness`);

    // Run the advanced simulation
    const simulationResult = await runAdvancedMonteCarloSimulation(features, iterations);

    // Generate insights
    const insights = generateGameInsights(features, simulationResult);

    // Create result object
    const result: MonteCarloResult = {
      success: true,
      game_id: game_id,
      iterations: iterations,
      simulation_stats: simulationResult.stats,
      factors: simulationResult.factors,
      key_insights: insights,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Advanced Monte Carlo simulation completed successfully');
    console.log(`🎯 Results: ${simulationResult.stats.home_win_probability} vs ${simulationResult.stats.away_win_probability} | Score: ${simulationResult.stats.predicted_home_score}-${simulationResult.stats.predicted_away_score}`);

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

async function runAdvancedMonteCarloSimulation(features: any, iterations: number) {
  console.log(`🎲 Running ${iterations} advanced simulations...`);

  let homeWins = 0;
  let totalHomeRuns = 0;
  let totalAwayRuns = 0;
  let totalGames = 0;

  // Create player lookup maps
  const batterStatsMap = new Map();
  const pitcherStatsMap = new Map();
  const statcastMap = new Map();

  features.player_stats.batting_stats.forEach((stats: any) => {
    batterStatsMap.set(stats.player_id, stats);
  });

  features.player_stats.pitching_stats.forEach((stats: any) => {
    pitcherStatsMap.set(stats.player_id, stats);
  });

  features.player_stats.statcast_data.forEach((stats: any) => {
    statcastMap.set(stats.player_id, stats);
  });

  // Environmental factors
  const parkFactors = features.environmental.park_factors;
  const weatherData = features.environmental.weather_data;
  
  const parkRunsFactor = parkFactors?.runs_factor || 1.0;
  const parkHRFactor = parkFactors?.hr_factor || 1.0;
  const weatherTemp = weatherData?.temperature_f || 72;
  const weatherWindSpeed = weatherData?.wind_speed_mph || 5;
  
  // Weather adjustments
  let weatherRunsMultiplier = 1.0;
  if (weatherTemp > 80) weatherRunsMultiplier += 0.03;
  if (weatherTemp < 50) weatherRunsMultiplier -= 0.04;
  if (weatherWindSpeed > 15) weatherRunsMultiplier += 0.02;

  const homeAdvantage = 1.04; // 4% home field advantage

  for (let i = 0; i < iterations; i++) {
    // Simulate home team offense vs away pitcher
    const homeRuns = simulateAdvancedTeamOffense(
      features.lineups.home_batters,
      features.lineups.away_pitcher,
      batterStatsMap,
      pitcherStatsMap,
      statcastMap,
      parkRunsFactor,
      parkHRFactor,
      weatherRunsMultiplier * homeAdvantage
    );

    // Simulate away team offense vs home pitcher
    const awayRuns = simulateAdvancedTeamOffense(
      features.lineups.away_batters,
      features.lineups.home_pitcher,
      batterStatsMap,
      pitcherStatsMap,
      statcastMap,
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

  // Calculate confidence based on data quality
  const dataCompleteness = features.metadata.data_completeness;
  let confidence = 0.6 + (dataCompleteness.overall_score * 0.3); // Base on data quality

  // Adjust for lineup completeness
  if (features.lineups.home_batters.length >= 9 && features.lineups.away_batters.length >= 9) {
    confidence += 0.05;
  }

  // Adjust for pitcher availability
  if (features.lineups.home_pitcher && features.lineups.away_pitcher) {
    confidence += 0.05;
  }

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
    pitcher_fatigue: 1.0, // Future enhancement
    data_quality: dataCompleteness.overall_score
  };

  return { stats, factors };
}

function simulateAdvancedTeamOffense(
  batters: any[],
  opposingPitcher: any,
  batterStatsMap: Map<number, any>,
  pitcherStatsMap: Map<number, any>,
  statcastMap: Map<number, any>,
  parkRunsFactor: number,
  parkHRFactor: number,
  weatherMultiplier: number
): number {
  let runs = 0;
  let baseRunners = 0;

  // Get opposing pitcher stats and Statcast data
  const pitcherStats = opposingPitcher ? pitcherStatsMap.get(opposingPitcher.player_id) : null;
  const pitcherStatcast = opposingPitcher ? statcastMap.get(opposingPitcher.player_id) : null;

  // Pitcher effectiveness (lower ERA = harder to score against)
  const pitcherERA = pitcherStats?.era || 4.50;
  const pitcherWHIP = pitcherStats?.whip || 1.30;
  const pitcherEffectiveness = Math.min(1.4, Math.max(0.6, pitcherERA / 4.50));

  // Pitcher Statcast adjustments
  let pitcherAdjustment = pitcherEffectiveness;
  if (pitcherStatcast) {
    const whiffRate = (pitcherStatcast.whiff_pct || 25.0) / 100;
    const chaseRate = (pitcherStatcast.chase_pct || 30.0) / 100;
    const avgVelo = pitcherStatcast.avg_fastball_velocity || 92.0;
    
    // Higher whiff rate = harder to make contact
    pitcherAdjustment *= (1 + (whiffRate - 0.25) * 0.3);
    // Higher velocity = harder to barrel up
    pitcherAdjustment *= (1 + Math.max(0, (avgVelo - 92.0)) * 0.008);
  }

  for (const batter of batters) {
    const batterStats = batterStatsMap.get(batter.player_id);
    const batterStatcast = statcastMap.get(batter.player_id);

    // Get batter's Statcast metrics or use realistic defaults
    let xwOBA = 0.309; // 2024 league average
    let barrelRate = 0.072; // 7.2% league average
    let hardHitRate = 0.386; // 38.6% league average
    let strikeoutRate = 0.232; // 23.2% league average
    let walkRate = 0.087; // 8.7% league average

    // Use Statcast data if available
    if (batterStatcast) {
      xwOBA = batterStatcast.xwoba || 0.309;
      barrelRate = (batterStatcast.barrel_pct || 7.2) / 100;
      hardHitRate = (batterStatcast.hard_hit_pct || 38.6) / 100;
    }

    // Use traditional stats for K/BB rates
    if (batterStats && batterStats.at_bats > 50) {
      strikeoutRate = (batterStats.strikeouts || 0) / batterStats.at_bats;
      walkRate = (batterStats.walks || 0) / batterStats.at_bats;
    }

    // Apply environmental adjustments
    const adjustedXwOBA = xwOBA * weatherMultiplier * (1 / pitcherAdjustment);
    const adjustedBarrelRate = barrelRate * parkHRFactor * weatherMultiplier;
    const adjustedHardHitRate = hardHitRate * parkRunsFactor;
    const adjustedStrikeoutRate = strikeoutRate * pitcherAdjustment;
    const adjustedWalkRate = walkRate * (1 / pitcherAdjustment);

    // Simulate plate appearance
    const outcome = simulateAdvancedPlateAppearance(
      adjustedXwOBA,
      adjustedBarrelRate,
      adjustedHardHitRate,
      adjustedStrikeoutRate,
      adjustedWalkRate
    );

    // Apply outcome to game state
    switch (outcome.type) {
      case 'home_run':
        runs += baseRunners + 1;
        baseRunners = 0;
        break;
      case 'triple':
        runs += Math.floor(baseRunners * 0.95);
        baseRunners = 1;
        break;
      case 'double':
        runs += Math.floor(baseRunners * 0.85);
        baseRunners = Math.min(3, Math.floor(baseRunners * 0.3) + 1);
        break;
      case 'single':
        runs += Math.floor(baseRunners * 0.55);
        baseRunners = Math.min(3, Math.floor(baseRunners * 0.7) + 1);
        break;
      case 'walk':
        if (baseRunners >= 3) runs += 1;
        baseRunners = Math.min(3, baseRunners + 1);
        break;
      case 'productive_out':
        if (baseRunners > 0 && Math.random() < 0.45) {
          runs += 1;
          baseRunners = Math.max(0, baseRunners - 1);
        }
        break;
      case 'strikeout':
      case 'out':
        // No advancement
        break;
    }
  }

  // Score remaining runners with some probability
  runs += Math.floor(baseRunners * 0.4);

  return Math.max(0, Math.round(runs));
}

function simulateAdvancedPlateAppearance(
  xwOBA: number,
  barrelRate: number,
  hardHitRate: number,
  strikeoutRate: number,
  walkRate: number
) {
  const randomValue = Math.random();

  // First check for strikeout
  if (randomValue < strikeoutRate) {
    return { type: 'strikeout' };
  }

  // Then check for walk
  if (randomValue < strikeoutRate + walkRate) {
    return { type: 'walk' };
  }

  // Ball in play - check for barrel
  if (Math.random() < barrelRate) {
    // Barrel outcome - very likely to be a hit
    if (Math.random() < 0.85) { // 85% of barrels are hits
      if (Math.random() < 0.40) { // 40% of barrel hits are home runs
        return { type: 'home_run' };
      } else if (Math.random() < 0.30) { // 30% are doubles/triples
        return Math.random() < 0.15 ? { type: 'triple' } : { type: 'double' };
      } else {
        return { type: 'single' };
      }
    } else {
      return { type: 'productive_out' }; // Barrel that was caught
    }
  }

  // Check for hard hit contact
  if (Math.random() < hardHitRate) {
    // Hard hit balls have higher hit probability
    const hitProbability = Math.min(0.7, xwOBA * 1.8); // Convert xwOBA to hit probability
    if (Math.random() < hitProbability) {
      // Determine hit type based on xwOBA
      if (xwOBA > 0.400 && Math.random() < 0.20) {
        return Math.random() < 0.10 ? { type: 'triple' } : { type: 'double' };
      } else {
        return { type: 'single' };
      }
    } else {
      return Math.random() < 0.3 ? { type: 'productive_out' } : { type: 'out' };
    }
  }

  // Regular contact
  const hitProbability = Math.max(0.1, xwOBA * 1.2);
  if (Math.random() < hitProbability) {
    return { type: 'single' };
  } else {
    return Math.random() < 0.15 ? { type: 'productive_out' } : { type: 'out' };
  }
}

function generateGameInsights(features: any, simulationResult: any) {
  const homeTeam = features.teams.home;
  const awayTeam = features.teams.away;
  const factors = simulationResult.factors;
  const stats = simulationResult.stats;
  
  // Pitching matchup analysis
  const homePitcher = features.lineups.home_pitcher;
  const awayPitcher = features.lineups.away_pitcher;
  
  let pitchingMatchup = "Even matchup";
  if (homePitcher && awayPitcher) {
    // Could add more sophisticated pitcher comparison here
    pitchingMatchup = `${awayPitcher.player_name} vs ${homePitcher.player_name}`;
  }

  // Offensive edge
  let offensiveEdge = "Balanced offensive capabilities";
  if (stats.predicted_home_score > stats.predicted_away_score + 0.5) {
    offensiveEdge = `${homeTeam.name} has offensive advantage`;
  } else if (stats.predicted_away_score > stats.predicted_home_score + 0.5) {
    offensiveEdge = `${awayTeam.name} has offensive advantage`;
  }

  // Environmental impact
  let environmentalImpact = "Neutral conditions";
  if (factors.park_factor > 1.05) {
    environmentalImpact = "Hitter-friendly park boosts offense";
  } else if (factors.park_factor < 0.95) {
    environmentalImpact = "Pitcher-friendly park suppresses offense";
  }
  
  if (factors.weather_impact > 1.02) {
    environmentalImpact += ". Weather favors offense";
  } else if (factors.weather_impact < 0.98) {
    environmentalImpact += ". Weather favors pitching";
  }

  // Confidence drivers
  const confidenceDrivers = [];
  if (factors.data_quality > 0.8) {
    confidenceDrivers.push("High data completeness");
  }
  if (features.lineups.home_batters.length >= 9 && features.lineups.away_batters.length >= 9) {
    confidenceDrivers.push("Complete lineups available");
  }
  if (homePitcher && awayPitcher) {
    confidenceDrivers.push("Starting pitchers confirmed");
  }
  if (features.environmental.park_factors) {
    confidenceDrivers.push("Park factors included");
  }

  return {
    pitching_matchup: pitchingMatchup,
    offensive_edge: offensiveEdge,
    environmental_impact: environmentalImpact,
    confidence_drivers: confidenceDrivers
  };
}
