import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSchedule, getGameBoxscore, extractLineupsFromBoxscore, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP INGESTION FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Parse request parameters
    let targetDate = new Date().toISOString().split('T')[0];
    let forceRefresh = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.date) targetDate = body.date;
        if (body.force) forceRefresh = body.force;
      } catch (e) {
        // Use defaults
      }
    }

    const url = new URL(req.url);
    const urlDate = url.searchParams.get('date');
    const urlForce = url.searchParams.get('force');
    if (urlDate) targetDate = urlDate;
    if (urlForce) forceRefresh = urlForce === 'true';

    console.log(`🎯 Starting lineup ingestion for ${targetDate}, force: ${forceRefresh}`);

    // Create or get lineup ingestion job
    const jobId = crypto.randomUUID();
    const { error: jobError } = await supabase
      .from('lineup_ingestion_jobs')
      .insert({
        id: jobId,
        job_date: targetDate,
        status: 'running',
        started_at: new Date().toISOString()
      });

    if (jobError) {
      console.error('Failed to create job:', jobError);
      throw new Error(`Failed to create ingestion job: ${jobError.message}`);
    }

    // Step 1: Get team mapping from our database
    console.log('🏈 Step 1: Creating team mapping...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    const teamIdMapping = createTeamIdMapping(teams || []);
    console.log(`✅ Team mapping created with ${teamIdMapping.size} teams`);

    // Step 2: Get MLB schedule for the target date to get valid game IDs
    console.log('📅 Step 2: Fetching MLB schedule...');
    const schedule = await getSchedule(targetDate);
    
    if (!schedule?.dates?.[0]?.games || schedule.dates[0].games.length === 0) {
      console.log(`No games found in MLB schedule for ${targetDate}`);
      
      await supabase
        .from('lineup_ingestion_jobs')
        .update({
          status: 'completed',
          games_expected: 0,
          games_processed: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: `No games found in MLB schedule for ${targetDate}`,
        date: targetDate,
        games_processed: 0,
        games_expected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mlbGames = schedule.dates[0].games;
    console.log(`✅ Found ${mlbGames.length} games in MLB schedule for ${targetDate}`);

    // Update job with expected games count
    await supabase
      .from('lineup_ingestion_jobs')
      .update({ games_expected: mlbGames.length })
      .eq('id', jobId);

    // Step 3: Process each game and fetch lineups using the corrected boxscore endpoint
    const results = [];
    const failedGames = [];
    let processedCount = 0;

    for (const mlbGame of mlbGames) {
      try {
        const gameId = mlbGame.gamePk;
        console.log(`🏈 Processing game ${gameId}`);

        // Check if lineups already exist (unless force refresh)
        if (!forceRefresh) {
          const { data: existingLineups } = await supabase
            .from('game_lineups')
            .select('id')
            .eq('game_id', gameId)
            .limit(1);

          if (existingLineups && existingLineups.length > 0) {
            console.log(`⏭️ Lineups already exist for game ${gameId}, skipping`);
            processedCount++;
            continue;
          }
        }

        // Clear existing lineups if force refresh
        if (forceRefresh) {
          const { error: deleteError } = await supabase
            .from('game_lineups')
            .delete()
            .eq('game_id', gameId);
          
          if (deleteError) {
            console.error(`Error deleting existing lineups for game ${gameId}:`, deleteError);
          }
        }

        // Fetch lineups from the corrected boxscore endpoint
        console.log(`📥 Fetching boxscore data for game ${gameId}`);
        const boxscoreData = await getGameBoxscore(gameId);
        
        if (!boxscoreData) {
          console.log(`❌ No boxscore data available for game ${gameId}`);
          failedGames.push({
            gamePk: gameId,
            error: 'No boxscore data available'
          });
          continue;
        }

        // Extract lineups using the corrected boxscore extraction function
        const lineups = extractLineupsFromBoxscore(boxscoreData, gameId, teamIdMapping);
        
        console.log(`📊 Lineup extraction results for game ${gameId}:`);
        console.log(`  - Total lineups extracted: ${lineups.length}`);
        const battingLineups = lineups.filter(l => l.lineup_type === 'batting');
        const pitchingLineups = lineups.filter(l => l.lineup_type === 'pitching');
        console.log(`  - Batting lineups: ${battingLineups.length}`);
        console.log(`  - Pitching lineups: ${pitchingLineups.length}`);
        
        if (battingLineups.length > 0) {
          console.log(`  - Batting orders found: ${battingLineups.map(b => b.batting_order).sort((a, b) => a - b)}`);
        }
        
        if (lineups.length === 0) {
          console.log(`⚠️ No lineup data extracted for game ${gameId}`);
          failedGames.push({
            gamePk: gameId,
            error: 'No lineup data could be extracted'
          });
          continue;
        }

        // Validate that all lineups have the correct game_id
        const validLineups = lineups.filter(lineup => {
          if (!lineup.game_id || lineup.game_id !== gameId) {
            console.error(`❌ Invalid game_id for lineup: expected ${gameId}, got ${lineup.game_id}`);
            return false;
          }
          return true;
        });

        if (validLineups.length !== lineups.length) {
          console.error(`❌ Found ${lineups.length - validLineups.length} lineups with invalid game_id for game ${gameId}`);
        }

        if (validLineups.length === 0) {
          console.log(`❌ No valid lineups for game ${gameId}`);
          failedGames.push({
            gamePk: gameId,
            error: 'No valid lineups (game_id mismatch)'
          });
          continue;
        }

        // Insert lineups into game_lineups table
        console.log(`💾 Inserting ${validLineups.length} lineup entries for game ${gameId}`);
        const { error: insertError } = await supabase
          .from('game_lineups')
          .insert(validLineups);

        if (insertError) {
          console.error(`❌ Error inserting lineups for game ${gameId}:`, insertError);
          failedGames.push({
            gamePk: gameId,
            error: `Insert error: ${insertError.message}`
          });
          continue;
        }

        processedCount++;
        results.push({
          gamePk: gameId,
          lineupsInserted: validLineups.length,
          battingLineups: battingLineups.length,
          pitchingLineups: pitchingLineups.length,
          status: 'success'
        });

        console.log(`✅ Successfully processed game ${gameId} with ${validLineups.length} lineup entries (${battingLineups.length} batting, ${pitchingLineups.length} pitching)`);

      } catch (error) {
        console.error(`❌ Error processing game ${mlbGame.gamePk}:`, error);
        failedGames.push({
          gamePk: mlbGame.gamePk,
          error: error.message
        });
      }
    }

    // Update job completion status
    const jobStatus = failedGames.length === 0 ? 'completed' : 'completed_with_errors';
    await supabase
      .from('lineup_ingestion_jobs')
      .update({
        status: jobStatus,
        games_processed: processedCount,
        games_failed: failedGames.length,
        failed_games: failedGames.length > 0 ? failedGames : null,
        completed_at: new Date().toISOString(),
        error_details: failedGames.length > 0 ? `${failedGames.length} games failed to process` : null
      })
      .eq('id', jobId);

    const summary = {
      success: true,
      date: targetDate,
      games_expected: mlbGames.length,
      games_processed: processedCount,
      games_failed: failedGames.length,
      failed_games: failedGames,
      job_id: jobId,
      results: results,
      message: `Processed ${processedCount}/${mlbGames.length} games for ${targetDate}`
    };

    console.log('🎉 Lineup ingestion completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup ingestion failed:', error);
    
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
