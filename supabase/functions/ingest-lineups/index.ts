
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

    // Step 2: Get games from our database for the target date
    console.log('📅 Step 2: Fetching games from database...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id')
      .eq('game_date', targetDate);

    if (gamesError) {
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    if (!games || games.length === 0) {
      console.log(`No games found in database for ${targetDate}`);
      
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
        message: `No games found in database for ${targetDate}`,
        date: targetDate,
        games_processed: 0,
        games_expected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Found ${games.length} games in database for ${targetDate}`);

    // Update job with expected games count
    await supabase
      .from('lineup_ingestion_jobs')
      .update({ games_expected: games.length })
      .eq('id', jobId);

    // Step 3: Process each game and fetch lineups
    const results = [];
    const failedGames = [];
    let processedCount = 0;

    for (const game of games) {
      try {
        console.log(`🏈 Processing game ${game.game_id}`);

        // Check if lineups already exist (unless force refresh)
        if (!forceRefresh) {
          const { data: existingLineups } = await supabase
            .from('game_lineups')
            .select('id')
            .eq('game_id', game.game_id)
            .limit(1);

          if (existingLineups && existingLineups.length > 0) {
            console.log(`⏭️ Lineups already exist for game ${game.game_id}, skipping`);
            processedCount++;
            continue;
          }
        }

        // Clear existing lineups if force refresh
        if (forceRefresh) {
          await supabase
            .from('game_lineups')
            .delete()
            .eq('game_id', game.game_id);
        }

        // Fetch lineups from MLB API
        console.log(`📥 Fetching lineup data for game ${game.game_id}`);
        const boxscoreData = await getGameBoxscore(game.game_id);
        
        if (!boxscoreData) {
          console.log(`❌ No boxscore data available for game ${game.game_id}`);
          failedGames.push({
            gamePk: game.game_id,
            error: 'No boxscore data available'
          });
          continue;
        }

        // Extract lineups using the shared MLB API helper
        const lineups = extractLineupsFromBoxscore(boxscoreData, null, teamIdMapping);
        
        if (lineups.length === 0) {
          console.log(`⚠️ No lineup data extracted for game ${game.game_id}`);
          failedGames.push({
            gamePk: game.game_id,
            error: 'No lineup data could be extracted'
          });
          continue;
        }

        // Insert lineups into game_lineups table
        console.log(`💾 Inserting ${lineups.length} lineup entries for game ${game.game_id}`);
        const { error: insertError } = await supabase
          .from('game_lineups')
          .insert(lineups);

        if (insertError) {
          console.error(`❌ Error inserting lineups for game ${game.game_id}:`, insertError);
          failedGames.push({
            gamePk: game.game_id,
            error: `Insert error: ${insertError.message}`
          });
          continue;
        }

        processedCount++;
        results.push({
          gamePk: game.game_id,
          lineupsInserted: lineups.length,
          status: 'success'
        });

        console.log(`✅ Successfully processed game ${game.game_id} with ${lineups.length} lineup entries`);

      } catch (error) {
        console.error(`❌ Error processing game ${game.game_id}:`, error);
        failedGames.push({
          gamePk: game.game_id,
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
      games_expected: games.length,
      games_processed: processedCount,
      games_failed: failedGames.length,
      failed_games: failedGames,
      job_id: jobId,
      results: results,
      message: `Processed ${processedCount}/${games.length} games for ${targetDate}`
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
