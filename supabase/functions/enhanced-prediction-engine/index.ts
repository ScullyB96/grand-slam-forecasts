import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== ENHANCED PREDICTION ENGINE STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    let targetDate = new Date().toISOString().split('T')[0];
    let gameIds: number[] | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.date) targetDate = body.date;
        if (body.game_ids) gameIds = body.game_ids;
      } catch (e) {
        console.log('Using default parameters');
      }
    }

    console.log(`🎯 Generating enhanced predictions for ${targetDate}`);

    // Get games for the target date
    let gamesQuery = supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id, game_date, game_time')
      .eq('game_date', targetDate);
    
    if (gameIds) {
      gamesQuery = gamesQuery.in('game_id', gameIds);
    }

    const { data: games, error: gamesError } = await gamesQuery;

    if (gamesError) {
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: `No games found for ${targetDate}`,
        predictions_generated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Processing ${games.length} games`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const game of games) {
      try {
        console.log(`🏈 Processing game ${game.game_id}`);
        
        // Check lineup data quality
        const lineupQuality = await assessLineupQuality(supabase, game.game_id);
        console.log(`📈 Lineup quality for game ${game.game_id}:`, lineupQuality);
        
        let prediction;
        
        if (lineupQuality.score >= 0.8) {
          // High-quality lineup data - use Monte Carlo simulation
          console.log(`🎲 Using Monte Carlo simulation for game ${game.game_id}`);
          prediction = await generateMonteCarloprediction(supabase, game, lineupQuality);
        } else if (lineupQuality.score >= 0.5) {
          // Medium-quality data - use enhanced statistical model
          console.log(`📊 Using enhanced statistical model for game ${game.game_id}`);
          prediction = await generateEnhancedStatisticalPrediction(supabase, game, lineupQuality);
        } else {
          // Low-quality data - use basic team stats with lineup adjustments
          console.log(`⚙️ Using adjusted team stats model for game ${game.game_id}`);
          prediction = await generateAdjustedTeamStatsPrediction(supabase, game, lineupQuality);
        }

        // Add data quality metadata
        prediction.data_quality = lineupQuality;
        prediction.prediction_method = lineupQuality.score >= 0.8 ? 'monte_carlo' : 
                                     lineupQuality.score >= 0.5 ? 'enhanced_stats' : 'adjusted_team_stats';

        // Save prediction
        await savePrediction(supabase, prediction);
        
        results.push({
          game_id: game.game_id,
          status: 'success',
          method: prediction.prediction_method,
          data_quality_score: lineupQuality.score,
          confidence: prediction.confidence_score
        });
        
        successful++;
        
      } catch (error) {
        console.error(`❌ Error processing game ${game.game_id}:`, error);
        results.push({
          game_id: game.game_id,
          status: 'error',
          error: error.message
        });
        failed++;
      }
    }

    const summary = {
      success: true,
      date: targetDate,
      total_games: games.length,
      successful_predictions: successful,
      failed_predictions: failed,
      results: results,
      message: `Generated ${successful}/${games.length} enhanced predictions for ${targetDate}`
    };

    console.log('🎉 Enhanced prediction generation completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Enhanced prediction engine failed:', error);
    
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

async function assessLineupQuality(supabase: any, gameId: number) {
  const { data: lineups } = await supabase
    .from('game_lineups')
    .select('*')
    .eq('game_id', gameId);

  if (!lineups || lineups.length === 0) {
    return {
      score: 0,
      has_lineups: false,
      batting_lineups: 0,
      pitching_lineups: 0,
      is_projected: false,
      completeness: 0
    };
  }

  const battingLineups = lineups.filter(l => l.lineup_type === 'batting');
  const pitchingLineups = lineups.filter(l => l.lineup_type === 'pitching');
  const isProjected = lineups.some(l => l.is_projected);
  
  // Calculate completeness score
  const expectedBatters = 18; // 9 per team
  const expectedPitchers = 2;  // 1 per team
  
  const battingCompleteness = Math.min(battingLineups.length / expectedBatters, 1);
  const pitchingCompleteness = Math.min(pitchingLineups.length / expectedPitchers, 1);
  
  let score = (battingCompleteness * 0.7 + pitchingCompleteness * 0.3);
  
  // Penalize projected lineups
  if (isProjected) {
    score *= 0.7;
  }
  
  return {
    score,
    has_lineups: true,
    batting_lineups: battingLineups.length,
    pitching_lineups: pitchingLineups.length,
    is_projected: isProjected,
    completeness: battingCompleteness
  };
}

async function generateMonteCarloprediction(supabase: any, game: any, lineupQuality: any) {
  // Call the existing Monte Carlo simulation
  const { data: mcResult } = await supabase.functions.invoke('monte-carlo-simulation', {
    body: { game_ids: [game.game_id] }
  });

  if (mcResult?.predictions?.[0]) {
    return {
      ...mcResult.predictions[0],
      confidence_score: Math.min(0.95, (lineupQuality.score * 0.9) + 0.1)
    };
  }

  throw new Error('Monte Carlo simulation failed');
}

async function generateEnhancedStatisticalPrediction(supabase: any, game: any, lineupQuality: any) {
  // Get team stats and recent performance
  const { data: teamStats } = await supabase
    .from('team_stats')
    .select('*')
    .in('team_id', [game.home_team_id, game.away_team_id])
    .eq('season', 2025);

  const { data: recentGames } = await supabase
    .from('games')
    .select('*')
    .or(`home_team_id.in.(${game.home_team_id},${game.away_team_id}),away_team_id.in.(${game.home_team_id},${game.away_team_id})`)
    .neq('game_id', game.game_id)
    .order('game_date', { ascending: false })
    .limit(10);

  const homeStats = teamStats?.find(t => t.team_id === game.home_team_id);
  const awayStats = teamStats?.find(t => t.team_id === game.away_team_id);

  if (!homeStats || !awayStats) {
    throw new Error('Team stats not available');
  }

  // Enhanced calculation with lineup adjustments
  const homeAdj = 1 + (lineupQuality.score - 0.5) * 0.1;
  const awayAdj = 1 + (lineupQuality.score - 0.5) * 0.1;

  const homeRunsExpected = (homeStats.runs_scored / Math.max(homeStats.wins + homeStats.losses, 1)) * homeAdj;
  const awayRunsExpected = (awayStats.runs_scored / Math.max(awayStats.wins + awayStats.losses, 1)) * awayAdj;

  // Home field advantage
  const homeFieldBonus = 0.3;
  const adjustedHomeRuns = homeRunsExpected + homeFieldBonus;

  const totalRuns = adjustedHomeRuns + awayRunsExpected;
  const homeWinProb = adjustedHomeRuns / totalRuns;

  return {
    game_id: game.game_id,
    home_win_probability: Math.round(homeWinProb * 100) / 100,
    away_win_probability: Math.round((1 - homeWinProb) * 100) / 100,
    predicted_home_score: Math.round(adjustedHomeRuns),
    predicted_away_score: Math.round(awayRunsExpected),
    confidence_score: Math.min(0.85, lineupQuality.score * 0.8 + 0.2),
    key_factors: {
      lineup_quality: lineupQuality.score,
      home_field_advantage: homeFieldBonus,
      data_completeness: lineupQuality.completeness
    }
  };
}

async function generateAdjustedTeamStatsPrediction(supabase: any, game: any, lineupQuality: any) {
  // Basic team stats with minimal lineup adjustments
  const { data: teamStats } = await supabase
    .from('team_stats')
    .select('*')
    .in('team_id', [game.home_team_id, game.away_team_id])
    .eq('season', 2025);

  const homeStats = teamStats?.find(t => t.team_id === game.home_team_id);
  const awayStats = teamStats?.find(t => t.team_id === game.away_team_id);

  if (!homeStats || !awayStats) {
    throw new Error('Team stats not available');
  }

  const homeRunsExpected = homeStats.runs_scored / Math.max(homeStats.wins + homeStats.losses, 1);
  const awayRunsExpected = awayStats.runs_scored / Math.max(awayStats.wins + awayStats.losses, 1);

  // Minimal home field advantage
  const homeFieldBonus = 0.2;
  const adjustedHomeRuns = homeRunsExpected + homeFieldBonus;

  const totalRuns = adjustedHomeRuns + awayRunsExpected;
  const homeWinProb = adjustedHomeRuns / totalRuns;

  return {
    game_id: game.game_id,
    home_win_probability: Math.round(homeWinProb * 100) / 100,
    away_win_probability: Math.round((1 - homeWinProb) * 100) / 100,
    predicted_home_score: Math.round(adjustedHomeRuns),
    predicted_away_score: Math.round(awayRunsExpected),
    confidence_score: Math.min(0.70, lineupQuality.score * 0.6 + 0.3),
    key_factors: {
      method: 'basic_team_stats',
      lineup_quality: lineupQuality.score,
      home_field_advantage: homeFieldBonus,
      note: 'Limited data available'
    }
  };
}

async function savePrediction(supabase: any, prediction: any) {
  const { error } = await supabase
    .from('game_predictions')
    .upsert({
      game_id: prediction.game_id,
      home_win_probability: prediction.home_win_probability,
      away_win_probability: prediction.away_win_probability,
      predicted_home_score: prediction.predicted_home_score,
      predicted_away_score: prediction.predicted_away_score,
      confidence_score: prediction.confidence_score,
      key_factors: prediction.key_factors,
      prediction_date: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'game_id'
    });

  if (error) {
    throw new Error(`Failed to save prediction: ${error.message}`);
  }
}