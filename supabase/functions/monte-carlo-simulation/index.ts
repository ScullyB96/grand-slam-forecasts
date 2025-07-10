import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlayerStats {
  player_id: number;
  player_name: string;
  batting_order?: number;
  position: string;
  handedness: string;
  is_starter: boolean;
  
  // Batting stats (if batter)
  avg?: number;
  obp?: number;
  slg?: number;
  ops?: number;
  home_runs?: number;
  rbi?: number;
  strikeouts?: number;
  walks?: number;
  
  // Pitching stats (if pitcher)
  era?: number;
  whip?: number;
  k_9?: number;
  bb_9?: number;
  hr_9?: number;
  innings_pitched?: number;
}

interface SimulationFactors {
  park_factor: number;
  weather_impact: number;
  home_advantage: number;
  pitcher_fatigue: number;
}

interface InningResult {
  runs: number;
  hits: number;
  pitcher_pitches: number;
  outs_made: number;
}

interface GameSimulationResult {
  home_score: number;
  away_score: number;
  total_runs: number;
  game_details: {
    innings: InningResult[];
    bullpen_usage: {
      home_bullpen_era: number;
      away_bullpen_era: number;
    };
  };
}

serve(async (req) => {
  console.log('=== MONTE CARLO SIMULATION FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { game_id, iterations = 10000 } = await req.json();
    
    if (!game_id) {
      throw new Error('Game ID is required');
    }

    console.log(`Starting Monte Carlo simulation for game ${game_id} with ${iterations} iterations`);

    // Get game and team data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        game_id, home_team_id, away_team_id, venue_name, game_date,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('game_id', game_id)
      .single();

    if (gameError || !game) {
      throw new Error(`Failed to fetch game: ${gameError?.message}`);
    }

    // Get lineups with player stats
    const homeLineup = await getLineupWithStats(supabase, game_id, game.home_team_id);
    const awayLineup = await getLineupWithStats(supabase, game_id, game.away_team_id);

    // Get external factors
    const factors = await getSimulationFactors(supabase, game);

    // Run Monte Carlo simulation
    console.log(`Running ${iterations} simulations...`);
    const results: GameSimulationResult[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const gameResult = simulateGame(homeLineup, awayLineup, factors);
      results.push(gameResult);
      
      // Log progress every 1000 iterations
      if ((i + 1) % 1000 === 0) {
        console.log(`Completed ${i + 1}/${iterations} simulations`);
      }
    }

    // Calculate simulation statistics
    const stats = calculateSimulationStats(results);
    
    console.log('Monte Carlo simulation completed:', stats);

    return new Response(JSON.stringify({
      success: true,
      game_id,
      iterations,
      simulation_stats: stats,
      factors,
      timestamp: new Date().toISOString()
    }), {
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

// Get lineup with detailed player stats
async function getLineupWithStats(supabase: any, gameId: number, teamId: number): Promise<PlayerStats[]> {
  // Get lineup
  const { data: lineup } = await supabase
    .from('game_lineups')
    .select('*')
    .eq('game_id', gameId)
    .eq('team_id', teamId);

  if (!lineup) return [];

  const lineupWithStats: PlayerStats[] = [];

  for (const player of lineup) {
    const playerStats: PlayerStats = {
      player_id: player.player_id,
      player_name: player.player_name,
      batting_order: player.batting_order,
      position: player.position,
      handedness: player.handedness,
      is_starter: player.is_starter
    };

    if (player.lineup_type === 'batting') {
      // Get batting stats
      const { data: battingStats } = await supabase
        .from('batting_stats')
        .select('*')
        .eq('player_id', player.player_id)
        .eq('season', 2025)
        .maybeSingle();

      if (battingStats) {
        playerStats.avg = battingStats.avg || 0.250;
        playerStats.obp = battingStats.obp || 0.320;
        playerStats.slg = battingStats.slg || 0.400;
        playerStats.ops = battingStats.ops || 0.720;
        playerStats.home_runs = battingStats.home_runs || 0;
        playerStats.rbi = battingStats.rbi || 0;
        playerStats.strikeouts = battingStats.strikeouts || 0;
        playerStats.walks = battingStats.walks || 0;
      } else {
        // Default stats for unknown players
        playerStats.avg = 0.250;
        playerStats.obp = 0.320;
        playerStats.slg = 0.400;
        playerStats.ops = 0.720;
      }
    } else if (player.lineup_type === 'pitching') {
      // Get pitching stats
      const { data: pitchingStats } = await supabase
        .from('pitching_stats')
        .select('*')
        .eq('player_id', player.player_id)
        .eq('season', 2025)
        .maybeSingle();

      if (pitchingStats) {
        playerStats.era = pitchingStats.era || 4.50;
        playerStats.whip = pitchingStats.whip || 1.30;
        playerStats.k_9 = pitchingStats.k_9 || 8.0;
        playerStats.bb_9 = pitchingStats.bb_9 || 3.0;
        playerStats.hr_9 = pitchingStats.hr_9 || 1.2;
        playerStats.innings_pitched = pitchingStats.innings_pitched || 0;
      } else {
        // Default stats for unknown pitchers
        playerStats.era = 4.50;
        playerStats.whip = 1.30;
        playerStats.k_9 = 8.0;
        playerStats.bb_9 = 3.0;
        playerStats.hr_9 = 1.2;
      }
    }

    lineupWithStats.push(playerStats);
  }

  return lineupWithStats;
}

// Get simulation factors (park, weather, etc.)
async function getSimulationFactors(supabase: any, game: any): Promise<SimulationFactors> {
  // Get park factors
  const { data: parkFactor } = await supabase
    .from('park_factors')
    .select('*')
    .eq('venue_name', game.venue_name)
    .eq('season', 2025)
    .maybeSingle();

  // Get weather data
  const { data: weather } = await supabase
    .from('weather_data')
    .select('*')
    .eq('game_id', game.game_id)
    .maybeSingle();

  return {
    park_factor: parkFactor?.runs_factor || 1.0,
    weather_impact: calculateWeatherImpact(weather),
    home_advantage: 1.04, // 4% home advantage
    pitcher_fatigue: 1.0
  };
}

function calculateWeatherImpact(weather: any): number {
  if (!weather) return 1.0;
  
  let impact = 1.0;
  
  // Wind impact
  if (weather.wind_speed_mph > 15) {
    impact *= 0.95; // Strong wind reduces offense
  }
  
  // Temperature impact
  if (weather.temperature_f > 80) {
    impact *= 1.02; // Hot weather slightly increases offense
  } else if (weather.temperature_f < 50) {
    impact *= 0.98; // Cold weather slightly decreases offense
  }
  
  return Math.max(0.8, Math.min(1.2, impact));
}

// Core game simulation
function simulateGame(homeLineup: PlayerStats[], awayLineup: PlayerStats[], factors: SimulationFactors): GameSimulationResult {
  let homeScore = 0;
  let awayScore = 0;
  const innings: InningResult[] = [];
  
  const homeBatters = homeLineup.filter(p => p.batting_order).sort((a, b) => a.batting_order! - b.batting_order!);
  const awayBatters = awayLineup.filter(p => p.batting_order).sort((a, b) => a.batting_order! - b.batting_order!);
  const homeStartingPitcher = homeLineup.find(p => p.is_starter && !p.batting_order);
  const awayStartingPitcher = awayLineup.find(p => p.is_starter && !p.batting_order);

  let homePitcherPitches = 0;
  let awayPitcherPitches = 0;
  let homeCurrentBatter = 0;
  let awayCurrentBatter = 0;

  // Simulate 9 innings
  for (let inning = 1; inning <= 9; inning++) {
    // Top of inning (away team batting)
    const awayInningResult = simulateHalfInning(
      awayBatters,
      awayCurrentBatter,
      homeStartingPitcher || homeBatters[0], // Fallback to position player
      homePitcherPitches,
      factors,
      false // not home team
    );
    
    awayScore += awayInningResult.runs;
    homePitcherPitches += awayInningResult.pitcher_pitches;
    awayCurrentBatter = (awayCurrentBatter + awayInningResult.outs_made) % awayBatters.length;

    // Bottom of inning (home team batting)
    const homeInningResult = simulateHalfInning(
      homeBatters,
      homeCurrentBatter,
      awayStartingPitcher || awayBatters[0], // Fallback to position player
      awayPitcherPitches,
      factors,
      true // home team
    );
    
    homeScore += homeInningResult.runs;
    awayPitcherPitches += homeInningResult.pitcher_pitches;
    homeCurrentBatter = (homeCurrentBatter + homeInningResult.outs_made) % homeBatters.length;

    innings.push({
      runs: awayInningResult.runs + homeInningResult.runs,
      hits: awayInningResult.hits + homeInningResult.hits,
      pitcher_pitches: awayInningResult.pitcher_pitches + homeInningResult.pitcher_pitches,
      outs_made: 6 // 3 outs per half inning
    });

    // Check if game should end early (home team winning in bottom 9th)
    if (inning === 9 && homeScore > awayScore) {
      break;
    }
  }

  // Extra innings if tied
  let extraInning = 10;
  while (homeScore === awayScore && extraInning <= 15) {
    // Simulate extra innings with simplified logic
    const awayExtraRuns = Math.random() < 0.3 ? 1 : 0;
    const homeExtraRuns = Math.random() < 0.35 ? 1 : 0; // Slight home advantage

    awayScore += awayExtraRuns;
    homeScore += homeExtraRuns;
    
    if (homeScore !== awayScore) break;
    extraInning++;
  }

  return {
    home_score: homeScore,
    away_score: awayScore,
    total_runs: homeScore + awayScore,
    game_details: {
      innings,
      bullpen_usage: {
        home_bullpen_era: 4.2,
        away_bullpen_era: 4.1
      }
    }
  };
}

function simulateHalfInning(
  batters: PlayerStats[],
  startingBatter: number,
  pitcher: PlayerStats,
  pitcherPitches: number,
  factors: SimulationFactors,
  isHome: boolean
): InningResult {
  let runs = 0;
  let hits = 0;
  let outs = 0;
  let pitches = 0;
  let currentBatter = startingBatter;
  let runnersOnBase = [false, false, false]; // 1st, 2nd, 3rd

  // Pitcher fatigue factor
  const fatigueMultiplier = Math.max(0.8, 1 - (pitcherPitches / 1000));
  
  while (outs < 3) {
    const batter = batters[currentBatter];
    const plateAppearanceResult = simulatePlateAppearance(batter, pitcher, factors, fatigueMultiplier, isHome);
    
    pitches += plateAppearanceResult.pitches;
    
    switch (plateAppearanceResult.outcome) {
      case 'single':
        hits++;
        // Score runner from third, advance others
        if (runnersOnBase[2]) runs++;
        runnersOnBase = [true, runnersOnBase[0], runnersOnBase[1]];
        break;
        
      case 'double':
        hits++;
        // Score runners from second and third
        if (runnersOnBase[1]) runs++;
        if (runnersOnBase[2]) runs++;
        runnersOnBase = [false, true, runnersOnBase[0]];
        break;
        
      case 'triple':
        hits++;
        // Score all runners
        runs += runnersOnBase.filter(r => r).length;
        runnersOnBase = [false, false, true];
        break;
        
      case 'home_run':
        hits++;
        // Score all runners plus batter
        runs += runnersOnBase.filter(r => r).length + 1;
        runnersOnBase = [false, false, false];
        break;
        
      case 'walk':
        // Force advance if bases loaded, otherwise just take first
        if (runnersOnBase[0] && runnersOnBase[1] && runnersOnBase[2]) {
          runs++;
        }
        // Complex base running logic simplified
        runnersOnBase[0] = true;
        break;
        
      case 'strikeout':
      case 'groundout':
      case 'flyout':
        outs++;
        // Some outs advance runners
        if (plateAppearanceResult.outcome === 'flyout' && runnersOnBase[2] && Math.random() < 0.7) {
          runs++; // Sacrifice fly
          runnersOnBase[2] = false;
        }
        break;
    }
    
    currentBatter = (currentBatter + 1) % batters.length;
  }

  return {
    runs: Math.round(runs * factors.park_factor * factors.weather_impact),
    hits,
    pitcher_pitches: pitches,
    outs_made: outs
  };
}

function simulatePlateAppearance(
  batter: PlayerStats,
  pitcher: PlayerStats,
  factors: SimulationFactors,
  fatigueMultiplier: number,
  isHome: boolean
): { outcome: string; pitches: number } {
  const batterOBP = (batter.obp || 0.320) * (isHome ? factors.home_advantage : 1);
  const batterSLG = (batter.slg || 0.400) * factors.park_factor;
  const pitcherEffectiveness = Math.min(1.5, (pitcher.era || 4.50) / 4.50) * fatigueMultiplier;
  
  // Adjust probabilities based on matchup
  const adjustedOBP = Math.max(0.200, Math.min(0.500, batterOBP / pitcherEffectiveness));
  const adjustedSLG = Math.max(0.300, Math.min(0.700, batterSLG / pitcherEffectiveness));
  
  const random = Math.random();
  const pitches = Math.floor(Math.random() * 6) + 3; // 3-8 pitches
  
  if (random > adjustedOBP) {
    // Out
    const outType = Math.random();
    if (outType < 0.25) return { outcome: 'strikeout', pitches };
    if (outType < 0.65) return { outcome: 'groundout', pitches };
    return { outcome: 'flyout', pitches };
  } else {
    // On base
    const hitRandom = Math.random();
    if (hitRandom > (adjustedSLG / adjustedOBP)) {
      return { outcome: 'walk', pitches };
    }
    
    // Hit - determine type
    const hitType = Math.random();
    if (hitType < 0.70) return { outcome: 'single', pitches };
    if (hitType < 0.85) return { outcome: 'double', pitches };
    if (hitType < 0.95) return { outcome: 'triple', pitches };
    return { outcome: 'home_run', pitches };
  }
}

function calculateSimulationStats(results: GameSimulationResult[]) {
  const homeWins = results.filter(r => r.home_score > r.away_score).length;
  const awayWins = results.filter(r => r.away_score > r.home_score).length;
  const ties = results.filter(r => r.home_score === r.away_score).length;
  
  const totalGames = results.length;
  const avgHomeScore = results.reduce((sum, r) => sum + r.home_score, 0) / totalGames;
  const avgAwayScore = results.reduce((sum, r) => sum + r.away_score, 0) / totalGames;
  const avgTotalRuns = results.reduce((sum, r) => sum + r.total_runs, 0) / totalGames;

  // Over/under probabilities
  const overUnderLine = 8.5;
  const overs = results.filter(r => r.total_runs > overUnderLine).length;
  
  return {
    home_win_probability: homeWins / totalGames,
    away_win_probability: awayWins / totalGames,
    tie_probability: ties / totalGames,
    predicted_home_score: Math.round(avgHomeScore * 10) / 10,
    predicted_away_score: Math.round(avgAwayScore * 10) / 10,
    predicted_total_runs: Math.round(avgTotalRuns * 10) / 10,
    over_probability: overs / totalGames,
    under_probability: (totalGames - overs) / totalGames,
    over_under_line: overUnderLine,
    confidence_score: 0.85, // High confidence with Monte Carlo
    sample_size: totalGames
  };
}