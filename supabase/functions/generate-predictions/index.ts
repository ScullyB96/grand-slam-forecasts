import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GENERATE PREDICTIONS FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let jobId: number | null = null;

  try {
    console.log('Creating prediction generation job...');
    
    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'generate-predictions',
        job_type: 'prediction',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create job: ' + jobError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    jobId = jobRecord.id;
    console.log('Created job with ID:', jobId);

    // Get games to predict
    console.log('Fetching scheduled games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        game_id, home_team_id, away_team_id, venue_name, game_date,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .limit(10);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games to predict`);

    if (!games || games.length === 0) {
      console.log('No games found, completing job');
      await supabase
        .from('data_ingestion_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: 0
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: 'No games found to predict',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STEP 1: Automatically fetch lineups for all games
    console.log('🔄 Step 1: Fetching lineups for games...');
    await ingestLineups(supabase, games);

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // STEP 2: Generate Monte Carlo predictions using lineup data
    console.log('🔄 Step 2: Generating Monte Carlo predictions...');
    for (const game of games) {
      try {
        console.log(`Processing game ${game.game_id} (${game.away_team.abbreviation} @ ${game.home_team.abbreviation})...`);
        
        // Check if we have lineups for this game
        const { data: gameLineups, error: lineupsError } = await supabase
          .from('game_lineups')
          .select('*')
          .eq('game_id', game.game_id);

        if (lineupsError) {
          console.error(`Error fetching lineups for game ${game.game_id}:`, lineupsError);
          errors++;
          errorDetails.push(`Failed to fetch lineups for game ${game.game_id}`);
          continue;
        }

        const homeLineup = gameLineups?.filter(l => l.team_id === game.home_team_id) || [];
        const awayLineup = gameLineups?.filter(l => l.team_id === game.away_team_id) || [];
        
        console.log(`Found ${homeLineup.length} home players, ${awayLineup.length} away players for game ${game.game_id}`);

        let prediction;

        // Try Monte Carlo simulation if we have sufficient lineup data
        if (homeLineup.length >= 9 && awayLineup.length >= 9) {
          console.log(`Running Monte Carlo simulation for game ${game.game_id}...`);
          
          try {
            // Call Monte Carlo simulation function
            const { data: simulationResult, error: simError } = await supabase.functions.invoke('monte-carlo-simulation', {
              body: { 
                game_id: game.game_id,
                iterations: 5000 // Reduced for performance
              }
            });

            if (simError) {
              console.error(`Monte Carlo simulation failed for game ${game.game_id}:`, simError);
              throw simError;
            }

            if (simulationResult?.success) {
              console.log(`✅ Monte Carlo simulation completed for game ${game.game_id}`);
              const stats = simulationResult.simulation_stats;
              
              prediction = {
                game_id: game.game_id,
                home_win_probability: stats.home_win_probability,
                away_win_probability: stats.away_win_probability,
                predicted_home_score: Math.round(stats.predicted_home_score),
                predicted_away_score: Math.round(stats.predicted_away_score),
                over_under_line: stats.over_under_line,
                over_probability: stats.over_probability,
                under_probability: stats.under_probability,
                confidence_score: stats.confidence_score,
                key_factors: {
                  prediction_method: 'monte_carlo_simulation',
                  sample_size: stats.sample_size,
                  simulation_factors: simulationResult.factors,
                  avg_total_runs: stats.predicted_total_runs
                },
                prediction_date: new Date().toISOString(),
                last_updated: new Date().toISOString()
              };
            } else {
              throw new Error('Monte Carlo simulation returned unsuccessful result');
            }
          } catch (mcError) {
            console.error(`Monte Carlo simulation failed for game ${game.game_id}, falling back to basic prediction:`, mcError);
            // Fall back to basic prediction
            prediction = await calculateBasicPrediction(supabase, game, homeLineup, awayLineup);
          }
        } else {
          console.log(`Insufficient lineup data for game ${game.game_id}, using basic prediction`);
          prediction = await calculateBasicPrediction(supabase, game, homeLineup, awayLineup);
        }

        console.log(`Saving prediction for game ${game.game_id}:`, prediction);
        
        // Save prediction
        const { error: predError } = await supabase
          .from('game_predictions')
          .upsert(prediction, { 
            onConflict: 'game_id',
            ignoreDuplicates: false 
          });

        if (predError) {
          console.error(`Error saving prediction for game ${game.game_id}:`, predError);
          errors++;
          errorDetails.push(`Failed to save prediction for game ${game.game_id}: ${predError.message}`);
        } else {
          processed++;
          console.log(`✅ Successfully created lineup-based prediction for game ${game.game_id}`);
        }

      } catch (gameError) {
        console.error(`Error processing game ${game.game_id}:`, gameError);
        errors++;
        errorDetails.push(`Error processing game ${game.game_id}: ${gameError.message}`);
      }
    }

    // Complete job
    console.log(`Completing job: ${processed} processed, ${errors} errors`);
    const updateResult = await supabase
      .from('data_ingestion_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: games.length,
        records_inserted: processed,
        errors_count: errors,
        error_details: errorDetails.length > 0 ? { errors: errorDetails } : null
      })
      .eq('id', jobId);

    if (updateResult.error) {
      console.error('Failed to update job status:', updateResult.error);
    }

    console.log('✅ Prediction generation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_games: games.length,
      message: `Generated ${processed} predictions with ${errors} errors`,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Prediction generation failed:', error);
    
    // Update job as failed if we have a job ID
    if (jobId) {
      try {
        await supabase
          .from('data_ingestion_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { error: error.message }
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('Failed to update job as failed:', updateError);
      }
    }
    
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

// Helper function to ingest lineups automatically
async function ingestLineups(supabase: any, games: any[]) {
  console.log('🔄 Automatically ingesting lineups...');
  
  for (const game of games) {
    try {
      // Try to get official lineups from MLB Stats API
      const gameData = await getGameLineups(game.game_id);
      const officialLineups = extractLineupsFromGameFeed(gameData);
      
      if (officialLineups.length > 0) {
        console.log(`✅ Found official lineup for game ${game.game_id}`);
        
        // Clear existing lineups for this game
        await supabase
          .from('game_lineups')
          .delete()
          .eq('game_id', game.game_id);
          
        // Insert official lineups
        await supabase
          .from('game_lineups')
          .insert(officialLineups);
      } else {
        console.log(`⏳ Official lineup not available for game ${game.game_id}, checking for existing projected lineups...`);
        
        // Check if we already have projected lineups
        const { data: existingLineups } = await supabase
          .from('game_lineups')
          .select('id')
          .eq('game_id', game.game_id)
          .limit(1);
          
        if (!existingLineups || existingLineups.length === 0) {
          console.log(`Creating mock lineup for game ${game.game_id} as fallback`);
          // Create basic mock lineup with typical positions
          const mockLineups = createMockLineupForGame(game);
          await supabase
            .from('game_lineups')
            .insert(mockLineups);
        }
      }
    } catch (error) {
      console.error(`Error processing lineup for game ${game.game_id}:`, error);
      
      // Create mock lineup as fallback
      const mockLineups = createMockLineupForGame(game);
      await supabase
        .from('game_lineups')
        .insert(mockLineups);
    }
  }
}

// Helper function to create mock lineup for a single game
function createMockLineupForGame(game: any) {
  const lineups: any[] = [];
  const mockPlayers = [
    'Leadoff Hitter', 'Contact Hitter', 'Power Hitter', 'Cleanup Hitter', 'RBI Guy',
    'Gap Hitter', 'Speed Demon', 'Defensive Specialist', 'Switch Hitter'
  ];
  const positions = ['CF', '2B', 'RF', '1B', 'DH', 'LF', '3B', 'C', 'SS'];
  
  // Create batting lineups for both teams
  [game.home_team_id, game.away_team_id].forEach((teamId, teamIndex) => {
    const teamName = teamIndex === 0 ? game.home_team.abbreviation : game.away_team.abbreviation;
    
    // Add 9 batters
    for (let order = 1; order <= 9; order++) {
      lineups.push({
        game_id: game.game_id,
        team_id: teamId,
        lineup_type: 'batting',
        batting_order: order,
        player_id: 0,
        player_name: `${mockPlayers[order - 1]} (${teamName})`,
        position: positions[order - 1],
        handedness: Math.random() > 0.3 ? 'R' : 'L', // 70% righties
        is_starter: true
      });
    }
    
    // Add starting pitcher
    lineups.push({
      game_id: game.game_id,
      team_id: teamId,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 0,
      player_name: `Starting Pitcher (${teamName})`,
      position: 'SP',
      handedness: Math.random() > 0.25 ? 'R' : 'L', // 75% righties for pitchers
      is_starter: true
    });
  });
  
  return lineups;
}

// Helper function to calculate basic predictions (fallback)
async function calculateBasicPrediction(
  supabase: any,
  game: any,
  homeLineup: any[],
  awayLineup: any[]
) {
  console.log(`🧮 Calculating lineup-based prediction for game ${game.game_id}`);
  
  // Get basic team stats as baseline
  const { data: homeStats } = await supabase
    .from('team_stats')
    .select('*')
    .eq('team_id', game.home_team_id)
    .eq('season', 2025)
    .maybeSingle();
    
  const { data: awayStats } = await supabase
    .from('team_stats')
    .select('*')
    .eq('team_id', game.away_team_id)
    .eq('season', 2025)
    .maybeSingle();

  // Calculate batting lineup strength (simplified)
  const homeBattingLineup = homeLineup.filter(p => p.lineup_type === 'batting').sort((a, b) => a.batting_order - b.batting_order);
  const awayBattingLineup = awayLineup.filter(p => p.lineup_type === 'batting').sort((a, b) => a.batting_order - b.batting_order);
  
  // Lineup quality factors (placeholder - would use real player stats in production)
  const homeLineupQuality = calculateLineupQuality(homeBattingLineup);
  const awayLineupQuality = calculateLineupQuality(awayBattingLineup);
  
  // Get starting pitchers
  const homeStartingPitcher = homeLineup.find(p => p.lineup_type === 'pitching' && p.is_starter);
  const awayStartingPitcher = awayLineup.find(p => p.lineup_type === 'pitching' && p.is_starter);
  
  // Pitcher matchup factor
  const pitcherMatchup = calculatePitcherMatchup(homeStartingPitcher, awayStartingPitcher);
  
  // Base win percentages from team stats
  const homeWinPct = homeStats ? homeStats.wins / Math.max(1, homeStats.wins + homeStats.losses) : 0.500;
  const awayWinPct = awayStats ? awayStats.wins / Math.max(1, awayStats.wins + awayStats.losses) : 0.500;
  
  // Adjust probabilities based on lineup and pitching
  const homeAdvantage = 0.04; // 4% home field advantage
  let homeWinProb = (homeWinPct * 0.4) + (homeLineupQuality * 0.3) + (pitcherMatchup.homePitcherAdvantage * 0.2) + (homeAdvantage * 0.1);
  
  // Normalize probabilities
  homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
  const awayWinProb = Math.round((1 - homeWinProb) * 1000) / 1000;
  homeWinProb = Math.round(homeWinProb * 1000) / 1000;
  
  // Calculate expected runs based on lineup strength and pitcher quality
  const baseHomeRuns = homeStats ? homeStats.runs_scored / Math.max(1, homeStats.wins + homeStats.losses) : 4.5;
  const baseAwayRuns = awayStats ? awayStats.runs_scored / Math.max(1, awayStats.wins + awayStats.losses) : 4.5;
  
  const homeExpectedRuns = Math.max(3, Math.min(10, baseHomeRuns * homeLineupQuality + (Math.random() * 1 - 0.5)));
  const awayExpectedRuns = Math.max(3, Math.min(10, baseAwayRuns * awayLineupQuality + (Math.random() * 1 - 0.5)));
  
  const totalRuns = homeExpectedRuns + awayExpectedRuns;
  const overUnderLine = 8.5;
  
  return {
    game_id: game.game_id,
    home_win_probability: homeWinProb,
    away_win_probability: awayWinProb,
    predicted_home_score: Math.round(homeExpectedRuns),
    predicted_away_score: Math.round(awayExpectedRuns),
    over_under_line: overUnderLine,
    over_probability: totalRuns > overUnderLine ? 0.55 : 0.45,
    under_probability: totalRuns > overUnderLine ? 0.45 : 0.55,
    confidence_score: 0.78, // Higher confidence with lineup data
    key_factors: {
      home_starting_pitcher: homeStartingPitcher?.player_name || 'Unknown',
      away_starting_pitcher: awayStartingPitcher?.player_name || 'Unknown',
      home_lineup_quality: Math.round(homeLineupQuality * 100) / 100,
      away_lineup_quality: Math.round(awayLineupQuality * 100) / 100,
      pitcher_matchup_advantage: pitcherMatchup.advantage,
      home_win_pct: homeWinPct,
      away_win_pct: awayWinPct,
      prediction_method: 'lineup_based'
    },
    prediction_date: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
}

// Calculate lineup quality (placeholder algorithm)
function calculateLineupQuality(battingLineup: any[]) {
  let quality = 0.5; // Base quality
  
  // Factors that improve lineup quality
  const leftHandedBatters = battingLineup.filter(p => p.handedness === 'L').length;
  const platoonAdvantage = Math.min(leftHandedBatters / 9, 0.4); // Up to 40% lefties is good
  
  // Position-based adjustments (placeholder)
  const hasGoodTopOfOrder = battingLineup.slice(0, 3).length === 3;
  const hasCleanupHitter = battingLineup.length >= 4;
  
  quality += platoonAdvantage * 0.1;
  quality += hasGoodTopOfOrder ? 0.05 : 0;
  quality += hasCleanupHitter ? 0.05 : 0;
  
  // Add some variance
  quality += (Math.random() * 0.2 - 0.1);
  
  return Math.max(0.3, Math.min(1.2, quality));
}

// Calculate pitcher matchup advantage
function calculatePitcherMatchup(homePitcher: any, awayPitcher: any) {
  let homeAdvantage = 0.5; // Neutral
  
  if (homePitcher && awayPitcher) {
    // Handedness matchup (simplified)
    const bothRighty = homePitcher.handedness === 'R' && awayPitcher.handedness === 'R';
    const bothLefty = homePitcher.handedness === 'L' && awayPitcher.handedness === 'L';
    
    if (bothRighty || bothLefty) {
      homeAdvantage += 0.02; // Slight home advantage in similar handedness
    }
  }
  
  return {
    homePitcherAdvantage: homeAdvantage,
    advantage: homePitcher?.handedness === 'L' ? 'Lefty vs Lineup' : 'Standard Matchup'
  };
}