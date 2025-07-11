
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

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each game
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

        // Check if we have sufficient lineup data for Monte Carlo simulation
        if (homeLineup.length >= 9 && awayLineup.length >= 9) {
          console.log(`Running Monte Carlo simulation for game ${game.game_id} with official lineups...`);
          
          try {
            // Call Monte Carlo simulation function
            const { data: simulationResult, error: simError } = await supabase.functions.invoke('monte-carlo-simulation', {
              body: { 
                game_id: game.game_id,
                iterations: 10000
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
                predicted_home_score: stats.predicted_home_score,
                predicted_away_score: stats.predicted_away_score,
                over_under_line: stats.over_under_line,
                over_probability: stats.over_probability,
                under_probability: stats.under_probability,
                confidence_score: stats.confidence_score,
                key_factors: {
                  prediction_method: 'monte_carlo_simulation',
                  sample_size: stats.sample_size,
                  simulation_factors: simulationResult.factors,
                  avg_total_runs: stats.predicted_total_runs,
                  lineup_status: 'loaded',
                  home_lineup_size: homeLineup.length,
                  away_lineup_size: awayLineup.length
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
          console.log(`Insufficient lineup data for game ${game.game_id}, using team-stats-only prediction`);
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
          console.log(`✅ Successfully created prediction for game ${game.game_id}`);
        }

      } catch (gameError) {
        console.error(`Error processing game ${game.game_id}:`, gameError);
        errors++;
        errorDetails.push(`Error processing game ${game.game_id}: ${gameError.message}`);
      }
    }

    // Complete job
    console.log(`Completing job: ${processed} processed, ${errors} errors`);
    await supabase
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

// Helper function to calculate basic predictions (fallback)
async function calculateBasicPrediction(
  supabase: any,
  game: any,
  homeLineup: any[],
  awayLineup: any[]
) {
  console.log(`🧮 Calculating basic prediction for game ${game.game_id}`);
  
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

  // Base win percentages from team stats
  const homeWinPct = homeStats ? homeStats.wins / Math.max(1, homeStats.wins + homeStats.losses) : 0.500;
  const awayWinPct = awayStats ? awayStats.wins / Math.max(1, awayStats.wins + awayStats.losses) : 0.500;
  
  // Calculate win probability with home field advantage
  const homeAdvantage = 0.04; // 4% home field advantage
  let homeWinProb = (homeWinPct * 0.6) + 0.5 + homeAdvantage;
  
  // Normalize probabilities
  homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
  const awayWinProb = Math.round((1 - homeWinProb) * 1000) / 1000;
  homeWinProb = Math.round(homeWinProb * 1000) / 1000;
  
  // Calculate expected runs
  const baseHomeRuns = homeStats ? homeStats.runs_scored / Math.max(1, homeStats.wins + homeStats.losses) : 4.5;
  const baseAwayRuns = awayStats ? awayStats.runs_scored / Math.max(1, awayStats.wins + awayStats.losses) : 4.5;
  
  const homeExpectedRuns = Math.max(3, Math.min(10, baseHomeRuns + (Math.random() * 1 - 0.5)));
  const awayExpectedRuns = Math.max(3, Math.min(10, baseAwayRuns + (Math.random() * 1 - 0.5)));
  
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
    confidence_score: 0.65, // Lower confidence for basic predictions
    key_factors: {
      home_win_pct: homeWinPct,
      away_win_pct: awayWinPct,
      prediction_method: 'basic_team_stats',
      lineup_status: homeLineup.length + awayLineup.length > 0 ? 'partial' : 'none'
    },
    prediction_date: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
}
