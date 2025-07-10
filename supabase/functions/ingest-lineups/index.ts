
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineupPlayer {
  id: number;
  fullName: string;
  battingOrder?: number;
  position: {
    code: string;
    name: string;
  };
}

interface GameLineup {
  team: {
    id: number;
    name: string;
  };
  batters: LineupPlayer[];
  pitchers: LineupPlayer[];
}

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

    // Step 1: Get today's games from MLB API
    console.log('📅 Step 1: Fetching schedule from MLB API...');
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore`;
    const scheduleResponse = await fetch(scheduleUrl);
    
    if (!scheduleResponse.ok) {
      throw new Error(`Failed to fetch schedule: ${scheduleResponse.statusText}`);
    }

    const scheduleData = await scheduleResponse.json();
    const games = scheduleData.dates?.[0]?.games || [];
    
    if (games.length === 0) {
      console.log(`No games found for ${targetDate}`);
      
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
        message: `No games scheduled for ${targetDate}`,
        date: targetDate,
        games_processed: 0,
        games_expected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Found ${games.length} games for ${targetDate}`);

    // Update job with expected games count
    await supabase
      .from('lineup_ingestion_jobs')
      .update({ games_expected: games.length })
      .eq('id', jobId);

    // Step 2: Process each game and fetch lineups
    const results = [];
    const failedGames = [];
    let processedCount = 0;

    for (const game of games) {
      try {
        console.log(`🏈 Processing game ${game.gamePk}: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);

        // Check if lineups already exist (unless force refresh)
        if (!forceRefresh) {
          const { data: existingLineups } = await supabase
            .from('lineups')
            .select('id')
            .eq('game_pk', game.gamePk)
            .limit(1);

          if (existingLineups && existingLineups.length > 0) {
            console.log(`⏭️ Lineups already exist for game ${game.gamePk}, skipping`);
            processedCount++;
            continue;
          }
        }

        // Fetch lineups from MLB API
        const lineupUrl = `https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`;
        const lineupResponse = await fetch(lineupUrl);
        
        if (!lineupResponse.ok) {
          console.error(`Failed to fetch lineup for game ${game.gamePk}`);
          failedGames.push({
            gamePk: game.gamePk,
            error: `Failed to fetch lineup: ${lineupResponse.statusText}`
          });
          continue;
        }

        const lineupData = await lineupResponse.json();
        
        // Extract lineup data for both teams
        const awayTeam = lineupData.teams?.away;
        const homeTeam = lineupData.teams?.home;

        if (!awayTeam || !homeTeam) {
          console.error(`Invalid lineup data for game ${game.gamePk}`);
          failedGames.push({
            gamePk: game.gamePk,
            error: 'Invalid lineup data structure'
          });
          continue;
        }

        // Process away team lineup
        await processTeamLineup(supabase, game.gamePk, awayTeam, targetDate, forceRefresh);
        
        // Process home team lineup  
        await processTeamLineup(supabase, game.gamePk, homeTeam, targetDate, forceRefresh);

        processedCount++;
        results.push({
          gamePk: game.gamePk,
          awayTeam: game.teams.away.team.name,
          homeTeam: game.teams.home.team.name,
          status: 'success'
        });

        console.log(`✅ Successfully processed game ${game.gamePk}`);

      } catch (error) {
        console.error(`❌ Error processing game ${game.gamePk}:`, error);
        failedGames.push({
          gamePk: game.gamePk,
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

async function processTeamLineup(supabase: any, gamePk: number, teamData: any, date: string, forceRefresh: boolean) {
  const teamId = teamData.team?.id;
  if (!teamId) {
    console.error('No team ID found in team data');
    return;
  }

  // Clear existing lineups if force refresh
  if (forceRefresh) {
    await supabase
      .from('lineups')
      .delete()
      .eq('game_pk', gamePk)
      .eq('team_id', teamId);
  }

  // Process batters
  const batters = teamData.batters || [];
  for (let i = 0; i < batters.length; i++) {
    const playerId = batters[i];
    const playerInfo = teamData.players?.[`ID${playerId}`];
    
    if (playerInfo?.person) {
      const battingOrder = i + 1; // Batting order starts at 1
      const position = playerInfo.position;
      
      await supabase
        .from('lineups')
        .upsert({
          game_pk: gamePk,
          team_id: teamId,
          player_id: playerInfo.person.id,
          player_name: playerInfo.person.fullName,
          batting_order: battingOrder,
          position_code: position?.code || null,
          date: date
        }, {
          onConflict: 'game_pk,player_id'
        });
    }
  }

  // Process pitchers (starters and relievers)
  const pitchers = teamData.pitchers || [];
  for (const playerId of pitchers) {
    const playerInfo = teamData.players?.[`ID${playerId}`];
    
    if (playerInfo?.person) {
      await supabase
        .from('lineups')
        .upsert({
          game_pk: gamePk,
          team_id: teamId,
          player_id: playerInfo.person.id,
          player_name: playerInfo.person.fullName,
          batting_order: null, // Pitchers don't have batting order
          position_code: 'P',
          date: date
        }, {
          onConflict: 'game_pk,player_id'
        });
    }
  }

  console.log(`✅ Processed lineup for team ${teamId} in game ${gamePk}`);
}
