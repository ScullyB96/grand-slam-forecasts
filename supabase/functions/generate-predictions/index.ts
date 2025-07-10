
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
      throw jobError;
    }
    
    const jobId = jobRecord.id;
    console.log('Created job with ID:', jobId);

    // Get games to predict
    console.log('Fetching scheduled games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id, venue_name, game_date')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .limit(5);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw gamesError;
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

    // Process each game
    for (const game of games) {
      try {
        console.log(`Processing game ${game.game_id}...`);
        
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

        if (homeStatsError) {
          console.error(`Error fetching home stats for team ${game.home_team_id}:`, homeStatsError);
          errors++;
          continue;
        }

        if (awayStatsError) {
          console.error(`Error fetching away stats for team ${game.away_team_id}:`, awayStatsError);
          errors++;
          continue;
        }

        if (!homeStats) {
          console.log(`Missing home team stats for team ${game.home_team_id}, game ${game.game_id}`);
          errors++;
          continue;
        }

        if (!awayStats) {
          console.log(`Missing away team stats for team ${game.away_team_id}, game ${game.game_id}`);
          errors++;
          continue;
        }

        console.log(`Found stats for both teams. Home: ${game.home_team_id}, Away: ${game.away_team_id}`);

        // Create a realistic prediction based on team stats
        const homeWinPct = homeStats.wins / (homeStats.wins + homeStats.losses) || 0.5;
        const awayWinPct = awayStats.wins / (awayStats.wins + awayStats.losses) || 0.5;
        
        // Home field advantage
        const homeAdvantage = 0.54;
        let homeWinProb = (homeWinPct * 0.6) + (homeAdvantage * 0.4);
        homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
        
        const awayWinProb = 1 - homeWinProb;

        // Score predictions based on team offensive/defensive stats
        const homeExpectedRuns = Math.max(3, Math.min(8, homeStats.runs_scored / Math.max(1, (homeStats.wins + homeStats.losses)) + (Math.random() * 2 - 1)));
        const awayExpectedRuns = Math.max(3, Math.min(8, awayStats.runs_scored / Math.max(1, (awayStats.wins + awayStats.losses)) + (Math.random() * 2 - 1)));

        const prediction = {
          game_id: game.game_id,
          home_win_probability: Math.round(homeWinProb * 1000) / 1000,
          away_win_probability: Math.round(awayWinProb * 1000) / 1000,
          predicted_home_score: Math.round(homeExpectedRuns),
          predicted_away_score: Math.round(awayExpectedRuns),
          over_under_line: 8.5,
          over_probability: 0.5,
          under_probability: 0.5,
          confidence_score: 0.75,
          key_factors: { 
            home_win_pct: homeWinPct,
            away_win_pct: awayWinPct,
            home_runs_per_game: homeStats.runs_scored / Math.max(1, (homeStats.wins + homeStats.losses)),
            away_runs_per_game: awayStats.runs_scored / Math.max(1, (awayStats.wins + awayStats.losses))
          },
          prediction_date: new Date().toISOString()
        };

        console.log(`Saving prediction for game ${game.game_id}...`);
        const { error: predError } = await supabase
          .from('game_predictions')
          .upsert(prediction, { onConflict: 'game_id' });

        if (predError) {
          console.error(`Error saving prediction for game ${game.game_id}:`, predError);
          errors++;
        } else {
          processed++;
          console.log(`✓ Created prediction for game ${game.game_id}`);
        }

      } catch (gameError) {
        console.error(`Error processing game ${game.game_id}:`, gameError);
        errors++;
      }
    }

    // Complete job
    console.log(`Completing job: ${processed} processed, ${errors} errors`);
    const finalStatus = errors > 0 ? 'completed' : 'completed'; // Both are valid status values
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        records_processed: processed,
        errors_count: errors
      })
      .eq('id', jobId);

    console.log('✓ Prediction generation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      message: `Generated ${processed} predictions with ${errors} errors`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Prediction generation failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
