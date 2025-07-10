
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const EXPECTED_PLAYERS_PER_TEAM = 9;

interface RetryableError {
  gamePk: number;
  attempt: number;
  lastError: string;
  nextRetryAt: Date;
}

interface LineupValidationResult {
  gamePk: number;
  homeTeamId: number;
  awayTeamId: number;
  homeLineupCount: number;
  awayLineupCount: number;
  homePitchers: number;
  awayPitchers: number;
  isComplete: boolean;
  issues: string[];
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

    console.log(`🎯 Starting bulletproof lineup ingestion for ${targetDate}, force: ${forceRefresh}`);

    // Create or get lineup ingestion job
    const jobId = crypto.randomUUID();
    const startTime = new Date();
    
    const { error: jobError } = await supabase
      .from('lineup_ingestion_jobs')
      .insert({
        id: jobId,
        job_date: targetDate,
        status: 'running',
        started_at: startTime.toISOString()
      });

    if (jobError) {
      console.error('Failed to create job:', jobError);
      throw new Error(`Failed to create ingestion job: ${jobError.message}`);
    }

    // Step 1: Fetch and validate schedule
    console.log('📅 Step 1: Fetching and validating MLB schedule...');
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore`;
    
    let scheduleResponse;
    try {
      scheduleResponse = await fetch(scheduleUrl);
      if (!scheduleResponse.ok) {
        throw new Error(`Schedule API returned ${scheduleResponse.status}: ${scheduleResponse.statusText}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch schedule:', error);
      await logJobFailure(supabase, jobId, startTime, `Schedule fetch failed: ${error.message}`, 0, 0);
      throw error;
    }

    const scheduleData = await scheduleResponse.json();
    console.log('📊 Raw schedule response structure:', {
      hasDates: !!scheduleData.dates,
      datesLength: scheduleData.dates?.length || 0,
      firstDateGames: scheduleData.dates?.[0]?.games?.length || 0
    });

    // Validate schedule data
    if (!scheduleData.dates || scheduleData.dates.length === 0) {
      const errorMsg = `No date entries in schedule for ${targetDate}. Raw response: ${JSON.stringify(scheduleData)}`;
      console.error('❌', errorMsg);
      await logJobFailure(supabase, jobId, startTime, errorMsg, 0, 0);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'No games scheduled',
        debug: { scheduleData, targetDate }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const games = scheduleData.dates[0]?.games || [];
    
    if (games.length === 0) {
      const errorMsg = `Empty games array for ${targetDate}. Raw response: ${JSON.stringify(scheduleData)}`;
      console.error('❌', errorMsg);
      await logJobFailure(supabase, jobId, startTime, errorMsg, 0, 0);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'No games found in schedule',
        debug: { scheduleData, targetDate }
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

    // Step 2: Process each game with retry logic
    const results = [];
    const failedGames: RetryableError[] = [];
    const validationResults: LineupValidationResult[] = [];
    let processedCount = 0;

    for (const game of games) {
      try {
        console.log(`🏈 Processing game ${game.gamePk}: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);

        // Check if lineups already exist (unless force refresh)
        if (!forceRefresh) {
          const { data: existingLineups } = await supabase
            .from('game_lineups')
            .select('id')
            .eq('game_id', game.gamePk)
            .limit(1);

          if (existingLineups && existingLineups.length > 0) {
            console.log(`⏭️ Lineups already exist for game ${game.gamePk}, skipping`);
            processedCount++;
            continue;
          }
        }

        // Fetch boxscore with retry logic
        const lineupData = await fetchBoxscoreWithRetry(game.gamePk);
        if (!lineupData) {
          failedGames.push({
            gamePk: game.gamePk,
            attempt: MAX_RETRIES,
            lastError: 'Failed to fetch boxscore after all retries',
            nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS)
          });
          continue;
        }

        // Extract and validate lineup data
        const validation = await processGameLineupRobustly(supabase, game, lineupData, targetDate, forceRefresh);
        validationResults.push(validation);

        if (validation.isComplete) {
          processedCount++;
          results.push({
            gamePk: game.gamePk,
            awayTeam: game.teams.away.team.name,
            homeTeam: game.teams.home.team.name,
            status: 'success',
            validation
          });
          console.log(`✅ Successfully processed game ${game.gamePk}`);
        } else {
          console.warn(`⚠️ Incomplete lineup data for game ${game.gamePk}:`, validation.issues);
          results.push({
            gamePk: game.gamePk,
            awayTeam: game.teams.away.team.name,
            homeTeam: game.teams.home.team.name,
            status: 'incomplete',
            validation
          });
        }

      } catch (error) {
        console.error(`❌ Error processing game ${game.gamePk}:`, error);
        failedGames.push({
          gamePk: game.gamePk,
          attempt: 1,
          lastError: error.message,
          nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS)
        });
      }
    }

    // Step 3: Defensive data validation
    const totalExpectedLineups = games.length * 2 * EXPECTED_PLAYERS_PER_TEAM; // 2 teams per game, 9 players per team
    const actualLineups = validationResults.reduce((sum, v) => sum + v.homeLineupCount + v.awayLineupCount, 0);
    const completionRate = games.length > 0 ? (actualLineups / totalExpectedLineups) * 100 : 0;

    console.log(`📊 Data validation summary:`, {
      gamesProcessed: games.length,
      expectedLineups: totalExpectedLineups,
      actualLineups,
      completionRate: `${completionRate.toFixed(1)}%`,
      incompleteGames: validationResults.filter(v => !v.isComplete).length
    });

    // Alert if completion rate is below threshold
    const alerts = [];
    if (completionRate < 80) {
      alerts.push(`Low completion rate: ${completionRate.toFixed(1)}% (${actualLineups}/${totalExpectedLineups})`);
    }

    const underPopulatedGames = validationResults.filter(v => !v.isComplete);
    if (underPopulatedGames.length > 0) {
      alerts.push(`Under-populated games: ${underPopulatedGames.map(g => g.gamePk).join(', ')}`);
    }

    // Update job completion status
    const jobStatus = failedGames.length === 0 && alerts.length === 0 ? 'completed' : 'completed_with_errors';
    await supabase
      .from('lineup_ingestion_jobs')
      .update({
        status: jobStatus,
        games_processed: processedCount,
        games_failed: failedGames.length,
        failed_games: failedGames.length > 0 ? failedGames : null,
        completed_at: new Date().toISOString(),
        error_details: alerts.length > 0 ? alerts.join('; ') : null
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
      validation_summary: {
        totalExpectedLineups,
        actualLineups,
        completionRate: `${completionRate.toFixed(1)}%`,
        alerts
      },
      message: `Processed ${processedCount}/${games.length} games for ${targetDate}`
    };

    console.log('🎉 Bulletproof lineup ingestion completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup ingestion failed catastrophically:', error);
    
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

async function fetchBoxscoreWithRetry(gamePk: number, attempt: number = 1): Promise<any | null> {
  const boxscoreUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
  
  try {
    console.log(`📦 Fetching boxscore for game ${gamePk} (attempt ${attempt}/${MAX_RETRIES})`);
    
    const response = await fetch(boxscoreUrl);
    
    if (response.status === 404) {
      console.warn(`⚠️ Game ${gamePk} boxscore not found (404) - attempt ${attempt}`);
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return fetchBoxscoreWithRetry(gamePk, attempt + 1);
      } else {
        console.error(`❌ Game ${gamePk} failed after ${MAX_RETRIES} attempts`);
        return null;
      }
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate boxscore structure
    if (!data.teams || !data.teams.home || !data.teams.away) {
      console.warn(`⚠️ Invalid boxscore structure for game ${gamePk}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return fetchBoxscoreWithRetry(gamePk, attempt + 1);
      }
      return null;
    }

    return data;
    
  } catch (error) {
    console.error(`❌ Error fetching boxscore for game ${gamePk} (attempt ${attempt}):`, error);
    
    if (attempt < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchBoxscoreWithRetry(gamePk, attempt + 1);
    }
    
    return null;
  }
}

async function processGameLineupRobustly(
  supabase: any, 
  game: any, 
  boxscoreData: any, 
  date: string, 
  forceRefresh: boolean
): Promise<LineupValidationResult> {
  const validation: LineupValidationResult = {
    gamePk: game.gamePk,
    homeTeamId: 0,
    awayTeamId: 0,
    homeLineupCount: 0,
    awayLineupCount: 0,
    homePitchers: 0,
    awayPitchers: 0,
    isComplete: false,
    issues: []
  };

  try {
    // Get team mappings
    const { data: teams } = await supabase
      .from('teams')
      .select('id, team_id');
    
    const teamMap = new Map(teams?.map((t: any) => [t.team_id, t.id]) || []);

    const homeTeamId = teamMap.get(game.teams.home.team.id);
    const awayTeamId = teamMap.get(game.teams.away.team.id);

    if (!homeTeamId || !awayTeamId) {
      validation.issues.push(`Missing team mapping: home=${homeTeamId}, away=${awayTeamId}`);
      return validation;
    }

    validation.homeTeamId = homeTeamId;
    validation.awayTeamId = awayTeamId;

    // Clear existing lineups if force refresh
    if (forceRefresh) {
      const { error: deleteError } = await supabase
        .from('game_lineups')
        .delete()
        .eq('game_id', game.gamePk);
        
      if (deleteError) {
        console.error('Error clearing existing lineups:', deleteError);
      }
    }

    // Process both teams
    for (const [teamType, teamData] of [['home', boxscoreData.teams.home], ['away', boxscoreData.teams.away]]) {
      const currentTeamId = teamType === 'home' ? homeTeamId : awayTeamId;
      
      // Process batting lineup
      const batters = teamData.batters || [];
      const lineupEntries = [];
      
      for (let i = 0; i < Math.min(batters.length, EXPECTED_PLAYERS_PER_TEAM); i++) {
        const playerId = batters[i];
        const playerInfo = teamData.players?.[`ID${playerId}`];
        
        if (playerInfo?.person) {
          lineupEntries.push({
            game_id: game.gamePk,
            team_id: currentTeamId,
            player_id: playerInfo.person.id,
            player_name: playerInfo.person.fullName,
            batting_order: i + 1,
            position: playerInfo.position?.abbreviation || 'Unknown',
            lineup_type: 'batting',
            handedness: playerInfo.person.batSide?.code || 'R',
            is_starter: true
          });
        }
      }

      // Process pitchers
      const pitchers = teamData.pitchers || [];
      for (const playerId of pitchers) {
        const playerInfo = teamData.players?.[`ID${playerId}`];
        
        if (playerInfo?.person) {
          lineupEntries.push({
            game_id: game.gamePk,
            team_id: currentTeamId,
            player_id: playerInfo.person.id,
            player_name: playerInfo.person.fullName,
            batting_order: null,
            position: 'P',
            lineup_type: 'pitching',
            handedness: playerInfo.person.pitchHand?.code || 'R',
            is_starter: lineupEntries.filter(e => e.lineup_type === 'pitching').length === 0
          });
        }
      }

      // Upsert with conflict resolution
      if (lineupEntries.length > 0) {
        const { data: upsertResult, error: upsertError } = await supabase
          .from('game_lineups')
          .upsert(lineupEntries, {
            onConflict: 'game_id,player_id'
          })
          .select('id');

        if (upsertError) {
          console.error(`❌ Upsert error for ${teamType} team in game ${game.gamePk}:`, upsertError);
          validation.issues.push(`Upsert failed for ${teamType}: ${upsertError.message}`);
        } else {
          const insertedCount = upsertResult?.length || 0;
          const expectedCount = lineupEntries.length;
          
          if (insertedCount !== expectedCount) {
            validation.issues.push(`Row count mismatch for ${teamType}: expected ${expectedCount}, got ${insertedCount}`);
          }

          // Update validation counts
          const battingCount = lineupEntries.filter(e => e.lineup_type === 'batting').length;
          const pitchingCount = lineupEntries.filter(e => e.lineup_type === 'pitching').length;
          
          if (teamType === 'home') {
            validation.homeLineupCount = battingCount;
            validation.homePitchers = pitchingCount;
          } else {
            validation.awayLineupCount = battingCount;
            validation.awayPitchers = pitchingCount;
          }
        }
      } else {
        validation.issues.push(`No lineup entries found for ${teamType} team`);
      }
    }

    // Determine if lineup is complete
    validation.isComplete = 
      validation.homeLineupCount >= 8 && // Allow for some flexibility
      validation.awayLineupCount >= 8 &&
      validation.homePitchers >= 1 &&
      validation.awayPitchers >= 1 &&
      validation.issues.length === 0;

    console.log(`📊 Validation for game ${game.gamePk}:`, validation);

  } catch (error) {
    console.error(`❌ Error processing lineup for game ${game.gamePk}:`, error);
    validation.issues.push(`Processing error: ${error.message}`);
  }

  return validation;
}

async function logJobFailure(supabase: any, jobId: string, startTime: Date, error: string, processed: number, failed: number) {
  await supabase
    .from('lineup_ingestion_jobs')
    .update({
      status: 'failed',
      games_processed: processed,
      games_failed: failed,
      completed_at: new Date().toISOString(),
      error_details: error
    })
    .eq('id', jobId);
}
