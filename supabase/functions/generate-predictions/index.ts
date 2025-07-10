import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      .select('game_id, home_team_id, away_team_id, venue_name, game_date')
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
        console.log(`Processing game ${game.game_id} (${game.home_team_id} vs ${game.away_team_id})...`);
        
        // Check if we have team stats
        const { data: homeStats, error: homeStatsError } = await supabase
          .from('team_stats')
          .select('*')
          .eq('team_id', game.home_team_id)
          .eq('season', 2025)
          .maybeSingle();

        const { data: awayStats, error: awayStatsError } = await supabase
          .from('team_stats')
          .select('*')
          .eq('team_id', game.away_team_id)
          .eq('season', 2025)
          .maybeSingle();

        if (homeStatsError || awayStatsError) {
          const errorMsg = `Database error fetching stats for game ${game.game_id}`;
          console.error(errorMsg, { homeStatsError, awayStatsError });
          errors++;
          errorDetails.push(errorMsg);
          continue;
        }

        if (!homeStats) {
          const errorMsg = `Missing home team stats for team ${game.home_team_id}`;
          console.log(errorMsg);
          errors++;
          errorDetails.push(errorMsg);
          continue;
        }

        if (!awayStats) {
          const errorMsg = `Missing away team stats for team ${game.away_team_id}`;
          console.log(errorMsg);
          errors++;
          errorDetails.push(errorMsg);
          continue;
        }

        console.log(`Found stats for both teams. Home team stats:`, homeStats);
        console.log(`Away team stats:`, awayStats);

        // Create a realistic prediction based on team stats
        const homeWinPct = homeStats.wins / Math.max(1, (homeStats.wins + homeStats.losses));
        const awayWinPct = awayStats.wins / Math.max(1, (awayStats.wins + awayStats.losses));
        
        // Home field advantage + team strength
        const homeAdvantage = 0.54;
        let homeWinProb = (homeWinPct * 0.6) + (homeAdvantage * 0.4);
        homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
        
        const awayWinProb = Math.round((1 - homeWinProb) * 1000) / 1000;
        homeWinProb = Math.round(homeWinProb * 1000) / 1000;

        // Score predictions based on team offensive stats
        const homeRunsPerGame = homeStats.runs_scored / Math.max(1, (homeStats.wins + homeStats.losses));
        const awayRunsPerGame = awayStats.runs_scored / Math.max(1, (awayStats.wins + awayStats.losses));
        
        const homeExpectedRuns = Math.max(3, Math.min(10, homeRunsPerGame + (Math.random() * 2 - 1)));
        const awayExpectedRuns = Math.max(3, Math.min(10, awayRunsPerGame + (Math.random() * 2 - 1)));

        const prediction = {
          game_id: game.game_id,
          home_win_probability: homeWinProb,
          away_win_probability: awayWinProb,
          predicted_home_score: Math.round(homeExpectedRuns),
          predicted_away_score: Math.round(awayExpectedRuns),
          over_under_line: 8.5,
          over_probability: 0.5,
          under_probability: 0.5,
          confidence_score: 0.75,
          key_factors: { 
            home_win_pct: homeWinPct,
            away_win_pct: awayWinPct,
            home_runs_per_game: homeRunsPerGame,
            away_runs_per_game: awayRunsPerGame,
            home_team_record: `${homeStats.wins}-${homeStats.losses}`,
            away_team_record: `${awayStats.wins}-${awayStats.losses}`
          },
          prediction_date: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        console.log(`Saving prediction for game ${game.game_id}:`, prediction);
        
        // Use INSERT ... ON CONFLICT to handle upserts properly
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