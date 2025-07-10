import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEATURE_VERSION = '1.0.0';

interface TeamFeatures {
  team_id: number;
  game_date: string;
  
  // Basic stats
  win_percentage: number;
  runs_per_game: number;
  runs_allowed_per_game: number;
  run_differential: number;
  
  // Recent form (last 10 games)
  recent_wins: number;
  recent_losses: number;
  recent_form_streak: number;
  recent_runs_scored: number;
  recent_runs_allowed: number;
  
  // Situational splits
  home_win_percentage: number;
  away_win_percentage: number;
  vs_division_record: number;
  day_game_performance: number;
  night_game_performance: number;
  
  // Advanced metrics
  pythagorean_win_pct: number;
  team_era_plus: number;
  team_ops_plus: number;
  bullpen_era: number;
  save_percentage: number;
  
  // Momentum indicators
  games_above_500: number;
  last_7_days_performance: number;
  offensive_slump_indicator: number;
  pitching_hot_streak: number;
  
  // Injury/Lineup factors
  estimated_lineup_strength: number;
  rotation_fatigue_factor: number;
  
  // Weather sensitivity
  weather_performance_cold: number;
  weather_performance_hot: number;
  weather_performance_wind: number;
}

serve(async (req) => {
  console.log('=== FEATURE ENGINEERING PIPELINE ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { target_date, team_ids, force_refresh = false } = requestBody;
    
    const gameDate = target_date || new Date().toISOString().split('T')[0];
    console.log(`Engineering features for date: ${gameDate}`);

    // Get teams to process
    let teamsToProcess: number[] = [];
    if (team_ids && Array.isArray(team_ids)) {
      teamsToProcess = team_ids;
    } else {
      // Get all teams playing on the target date
      const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id')
        .eq('game_date', gameDate);
      
      const teamIds = new Set<number>();
      games?.forEach(game => {
        teamIds.add(game.home_team_id);
        teamIds.add(game.away_team_id);
      });
      teamsToProcess = Array.from(teamIds);
    }

    console.log(`Processing features for ${teamsToProcess.length} teams`);

    let processedCount = 0;
    let cacheHits = 0;
    const errors: string[] = [];

    for (const teamId of teamsToProcess) {
      try {
        // Check if features already exist and are current (unless force refresh)
        if (!force_refresh) {
          const { data: existingFeatures } = await supabase
            .from('feature_engineering_cache')
            .select('id')
            .eq('team_id', teamId)
            .eq('game_date', gameDate)
            .eq('feature_version', FEATURE_VERSION)
            .maybeSingle();

          if (existingFeatures) {
            console.log(`✓ Using cached features for team ${teamId}`);
            cacheHits++;
            continue;
          }
        }

        console.log(`🔧 Engineering features for team ${teamId}...`);
        
        // Generate comprehensive features
        const features = await generateTeamFeatures(supabase, teamId, gameDate);
        
        // Cache the features
        await supabase
          .from('feature_engineering_cache')
          .upsert({
            team_id: teamId,
            game_date: gameDate,
            features: features,
            feature_version: FEATURE_VERSION
          }, {
            onConflict: 'team_id,game_date,feature_version',
            ignoreDuplicates: false
          });

        processedCount++;
        console.log(`✅ Features engineered for team ${teamId}`);

      } catch (error) {
        console.error(`❌ Error processing team ${teamId}:`, error);
        errors.push(`Team ${teamId}: ${error.message}`);
      }
    }

    console.log(`🎯 Feature engineering complete: ${processedCount} processed, ${cacheHits} from cache`);

    return new Response(JSON.stringify({
      success: true,
      target_date: gameDate,
      feature_version: FEATURE_VERSION,
      teams_processed: processedCount,
      cache_hits: cacheHits,
      errors: errors.length,
      error_details: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Feature engineering failed:', error);
    
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

async function generateTeamFeatures(
  supabase: any, 
  teamId: number, 
  gameDate: string
): Promise<TeamFeatures> {
  
  const currentSeason = new Date(gameDate).getFullYear();
  const targetDate = new Date(gameDate);
  
  // Get team stats
  const { data: teamStats } = await supabase
    .from('team_stats')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', currentSeason)
    .single();

  if (!teamStats) {
    throw new Error(`No team stats found for team ${teamId} in ${currentSeason}`);
  }

  // Get recent games (last 30 days)
  const thirtyDaysAgo = new Date(targetDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentGames } = await supabase
    .from('games')
    .select('*')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte('game_date', thirtyDaysAgo.toISOString().split('T')[0])
    .lt('game_date', gameDate)
    .eq('status', 'final')
    .order('game_date', { ascending: false })
    .limit(30);

  // Get bullpen stats
  const { data: bullpenStats } = await supabase
    .from('bullpen_stats')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', currentSeason)
    .maybeSingle();

  // Get team trends
  const { data: teamTrends } = await supabase
    .from('team_trends')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', currentSeason)
    .maybeSingle();

  // Calculate basic metrics
  const totalGames = teamStats.wins + teamStats.losses;
  const winPercentage = totalGames > 0 ? teamStats.wins / totalGames : 0;
  const runsPerGame = totalGames > 0 ? teamStats.runs_scored / totalGames : 0;
  const runsAllowedPerGame = totalGames > 0 ? teamStats.runs_allowed / totalGames : 0;
  const runDifferential = teamStats.runs_scored - teamStats.runs_allowed;

  // Calculate recent form (last 10 games)
  const last10Games = recentGames?.slice(0, 10) || [];
  let recentWins = 0;
  let recentRunsScored = 0;
  let recentRunsAllowed = 0;

  for (const game of last10Games) {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    if (teamScore > oppScore) recentWins++;
    recentRunsScored += teamScore || 0;
    recentRunsAllowed += oppScore || 0;
  }

  const recentLosses = last10Games.length - recentWins;

  // Calculate streak
  let currentStreak = 0;
  let lastResult: 'W' | 'L' | null = null;

  for (const game of last10Games) {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    const result = (teamScore || 0) > (oppScore || 0) ? 'W' : 'L';
    
    if (lastResult === null) {
      lastResult = result;
      currentStreak = 1;
    } else if (result === lastResult) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Apply sign based on win/loss
  const recentFormStreak = lastResult === 'W' ? currentStreak : -currentStreak;

  // Calculate situational stats
  const homeWinPct = teamTrends?.home_wins && teamTrends?.home_losses 
    ? teamTrends.home_wins / (teamTrends.home_wins + teamTrends.home_losses) 
    : winPercentage;

  const awayWinPct = teamTrends?.away_wins && teamTrends?.away_losses
    ? teamTrends.away_wins / (teamTrends.away_wins + teamTrends.away_losses)
    : winPercentage;

  // Calculate advanced metrics
  const pythagoreanWinPct = calculatePythagoreanWinPct(teamStats.runs_scored, teamStats.runs_allowed);
  const teamEraPlus = calculateEraPlus(teamStats.team_era);
  const teamOpsPlus = calculateOpsPlus(teamStats.team_obp + teamStats.team_slg);

  // Bullpen metrics
  const bullpenEra = bullpenStats?.era || teamStats.team_era * 1.1;
  const savePercentage = bullpenStats?.save_opportunities > 0 
    ? (bullpenStats.saves || 0) / bullpenStats.save_opportunities 
    : 0.75;

  // Momentum indicators
  const gamesAbove500 = teamStats.wins - teamStats.losses;
  const last7DaysPerformance = calculateLast7DaysPerformance(recentGames?.slice(0, 7) || [], teamId);
  const offensiveSlumpIndicator = calculateOffensiveSlump(last10Games, teamId);
  const pitchingHotStreak = calculatePitchingStreak(last10Games, teamId);

  // Lineup and fatigue factors
  const estimatedLineupStrength = calculateLineupStrength(teamStats);
  const rotationFatigueFactor = calculateRotationFatigue(recentGames || [], teamId);

  // Weather performance (mock for now - would need historical weather data)
  const weatherPerformanceCold = 0.95 + Math.random() * 0.1; // Mock data
  const weatherPerformanceHot = 0.95 + Math.random() * 0.1;
  const weatherPerformanceWind = 0.95 + Math.random() * 0.1;

  return {
    team_id: teamId,
    game_date: gameDate,
    
    // Basic stats
    win_percentage: winPercentage,
    runs_per_game: runsPerGame,
    runs_allowed_per_game: runsAllowedPerGame,
    run_differential: runDifferential,
    
    // Recent form
    recent_wins: recentWins,
    recent_losses: recentLosses,
    recent_form_streak: recentFormStreak,
    recent_runs_scored: recentRunsScored,
    recent_runs_allowed: recentRunsAllowed,
    
    // Situational splits
    home_win_percentage: homeWinPct,
    away_win_percentage: awayWinPct,
    vs_division_record: teamTrends?.vs_left_wins || 0,
    day_game_performance: teamTrends?.day_game_wins || 0,
    night_game_performance: teamTrends?.night_game_wins || 0,
    
    // Advanced metrics
    pythagorean_win_pct: pythagoreanWinPct,
    team_era_plus: teamEraPlus,
    team_ops_plus: teamOpsPlus,
    bullpen_era: bullpenEra,
    save_percentage: savePercentage,
    
    // Momentum indicators
    games_above_500: gamesAbove500,
    last_7_days_performance: last7DaysPerformance,
    offensive_slump_indicator: offensiveSlumpIndicator,
    pitching_hot_streak: pitchingHotStreak,
    
    // Injury/Lineup factors
    estimated_lineup_strength: estimatedLineupStrength,
    rotation_fatigue_factor: rotationFatigueFactor,
    
    // Weather sensitivity
    weather_performance_cold: weatherPerformanceCold,
    weather_performance_hot: weatherPerformanceHot,
    weather_performance_wind: weatherPerformanceWind
  };
}

// Helper calculation functions
function calculatePythagoreanWinPct(runsScored: number, runsAllowed: number): number {
  if (runsScored <= 0 || runsAllowed <= 0) return 0.5;
  return (runsScored ** 2) / ((runsScored ** 2) + (runsAllowed ** 2));
}

function calculateEraPlus(era: number): number {
  const leagueEra = 4.50; // MLB average
  return era > 0 ? Math.round((leagueEra / era) * 100) : 100;
}

function calculateOpsPlus(ops: number): number {
  const leagueOps = 0.728; // MLB average
  return Math.round((ops / leagueOps) * 100);
}

function calculateLast7DaysPerformance(games: any[], teamId: number): number {
  if (games.length === 0) return 0;
  
  let wins = 0;
  for (const game of games) {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    if ((teamScore || 0) > (oppScore || 0)) wins++;
  }
  
  return games.length > 0 ? wins / games.length : 0;
}

function calculateOffensiveSlump(games: any[], teamId: number): number {
  if (games.length < 5) return 0;
  
  let lowScoringGames = 0;
  for (const game of games.slice(0, 5)) {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    
    if ((teamScore || 0) < 3) lowScoringGames++;
  }
  
  return lowScoringGames / 5; // Higher = more slumping
}

function calculatePitchingStreak(games: any[], teamId: number): number {
  if (games.length < 5) return 0;
  
  let qualityStarts = 0;
  for (const game of games.slice(0, 5)) {
    const isHome = game.home_team_id === teamId;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    if ((oppScore || 0) <= 3) qualityStarts++;
  }
  
  return qualityStarts / 5; // Higher = pitching better
}

function calculateLineupStrength(teamStats: any): number {
  // Simple estimation based on team offensive stats
  const opsScore = (teamStats.team_obp + teamStats.team_slg) / 0.728; // vs league average
  const avgScore = teamStats.team_avg / 0.250; // vs league average
  
  return Math.min(1.5, Math.max(0.5, (opsScore + avgScore) / 2));
}

function calculateRotationFatigue(games: any[], teamId: number): number {
  // Look at games in last 10 days to estimate rotation fatigue
  const last10Days = games.slice(0, 10);
  if (last10Days.length < 3) return 1.0; // No fatigue data
  
  // Count high-usage games (assume > 5 runs allowed = tired pitcher)
  let highUsageGames = 0;
  for (const game of last10Days) {
    const isHome = game.home_team_id === teamId;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    if ((oppScore || 0) > 5) highUsageGames++;
  }
  
  const fatigueRatio = highUsageGames / last10Days.length;
  return Math.max(0.8, 1.0 - (fatigueRatio * 0.2)); // 0.8 to 1.0 range
}