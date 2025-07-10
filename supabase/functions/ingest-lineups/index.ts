import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed, createTeamIdMapping, getSchedule } from '../shared/mlb-api.ts';

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

  let jobId: number | null = null;

  try {
    // Parse request body for date parameter
    let targetDate = new Date().toISOString().split('T')[0]; // Default to today
    let force = false;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.date) {
          targetDate = body.date;
        }
        if (body.force) {
          force = body.force;
        }
      } catch (e) {
        console.log('No valid JSON body, using defaults');
      }
    }
    
    // Also check URL parameters
    const url = new URL(req.url);
    const urlDate = url.searchParams.get('date');
    if (urlDate) {
      targetDate = urlDate;
    }
    
    console.log(`Target date: ${targetDate}, Force: ${force}`);
    console.log('Creating lineup ingestion job...');
    
    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-lineups',
        job_type: 'lineups',
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

    // Get games for the target date
    console.log('Fetching games for date:', targetDate);
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        game_id,
        home_team_id,
        away_team_id,
        game_time,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('game_date', targetDate)
      .eq('status', 'scheduled');

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games for ${targetDate}`);

    if (!games || games.length === 0) {
      console.log(`No games found for ${targetDate}, completing job`);
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
        message: `No games found for ${targetDate}`,
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get team mapping for MLB ID to database ID conversion
    console.log('Fetching team mapping...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    console.log('Available teams:', teams?.map(t => `${t.name} (MLB: ${t.team_id}, DB: ${t.id})`));
    const teamIdMapping = createTeamIdMapping(teams || []);
    console.log('Team mapping created:', Array.from(teamIdMapping.entries()));

    // Clear existing lineups for today's games first to prevent duplicates
    console.log('Clearing existing lineups to prevent duplicates...');
    for (const game of games) {
      const { error: deleteError } = await supabase
        .from('game_lineups')
        .delete()
        .eq('game_id', game.game_id);
      
      if (deleteError) {
        console.error(`Error clearing lineups for game ${game.game_id}:`, deleteError);
      } else {
        console.log(`✅ Cleared existing lineups for game ${game.game_id}`);
      }
    }

    // STEP 1: Try to get official lineups from MLB Stats API first  
    console.log('🔍 Step 1: Attempting to fetch official lineups from MLB Stats API...');
    let lineups: any[] = [];
    let officialLineupsFound = 0;
    
    for (const game of games) {
      try {
        console.log(`Fetching lineup for game ${game.game_id}`);
        const gameData = await getGameLineups(game.game_id);
        const gameLineups = extractLineupsFromGameFeed(gameData, teamIdMapping);
        
        if (gameLineups.length > 0) {
          lineups.push(...gameLineups);
          officialLineupsFound++;
          console.log(`✅ Found official lineup for game ${game.game_id} (${gameLineups.length} players)`);
        } else {
          console.log(`⏳ Official lineup not yet available for game ${game.game_id}`);
        }
      } catch (error) {
        console.error(`Failed to fetch lineup for game ${game.game_id}:`, error);
      }
    }

    console.log(`Official lineups found for ${officialLineupsFound}/${games.length} games`);

    // STEP 2: For games without official lineups, fetch probable pitchers from schedule API
    console.log('🔍 Step 2: Fetching probable pitchers for games without official lineups...');
    
    if (officialLineupsFound < games.length) {
      const gamesNeedingPitchers = games.filter(game => 
        !lineups.some(lineup => lineup.game_id === game.game_id && lineup.lineup_type === 'pitching')
      );

      for (const game of gamesNeedingPitchers) {
        try {
          // Fetch probable pitchers from MLB schedule API
          const scheduleData = await getSchedule(targetDate);
          const probablePitchers = extractProbablePitchersFromSchedule(scheduleData, game, teamIdMapping);
          
          if (probablePitchers.length > 0) {
            lineups.push(...probablePitchers);
            console.log(`✅ Added probable pitchers for game ${game.game_id}`);
          } else {
            console.log(`⚠️ No probable pitchers found for game ${game.game_id}`);
          }
        } catch (error) {
          console.error(`Failed to get probable pitchers for game ${game.game_id}:`, error);
        }
      }
    }

    // STEP 3: Log games without lineups (no mock creation)
    console.log('🔍 Step 3: Checking games without official lineups...');
    
    const gamesWithoutLineups = games.filter(game => 
      !lineups.some(lineup => lineup.game_id === game.game_id && lineup.lineup_type === 'batting')
    );

    if (gamesWithoutLineups.length > 0) {
      console.log(`⚠️ ${gamesWithoutLineups.length} games do not have official lineups yet:`);
      gamesWithoutLineups.forEach(game => {
        console.log(`  - Game ${game.game_id}: ${game.away_team?.name} @ ${game.home_team?.name}`);
      });
      console.log('These games will show "lineups not available" message to users.');
    }

    console.log(`Total lineups collected: ${lineups.length}`);
    
    // Store lineups in database
    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    if (lineups.length > 0) {
      // Validate team IDs before inserting
      console.log('Validating lineup team IDs...');
      const validLineups = [];
      const availableTeamIds = teams?.map(t => t.id) || [];
      
      for (const lineup of lineups) {
        if (availableTeamIds.includes(lineup.team_id)) {
          validLineups.push(lineup);
        } else {
          console.error(`❌ Invalid team ID ${lineup.team_id} for player ${lineup.player_name} in game ${lineup.game_id}`);
          errors++;
          errorDetails.push(`Invalid team ID ${lineup.team_id} for player ${lineup.player_name}`);
        }
      }
      
      console.log(`Valid lineups: ${validLineups.length}, Invalid: ${lineups.length - validLineups.length}`);
      
      if (validLineups.length > 0) {
        // Insert valid lineups
        const { error: lineupError } = await supabase
          .from('game_lineups')
          .insert(validLineups);

        if (lineupError) {
          console.error('Error inserting lineups:', lineupError);
          errors++;
          errorDetails.push(`Failed to insert lineups: ${lineupError.message}`);
        } else {
          processed = validLineups.length;
          console.log(`✅ Successfully inserted ${processed} lineup entries`);
        }
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

    console.log('✅ Lineup ingestion completed successfully');

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_games: games.length,
      official_lineups: officialLineupsFound,
      message: `Ingested lineups for ${processed} players with ${errors} errors (${officialLineupsFound} official)`,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup ingestion failed:', error);
    
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

// Extract probable pitchers from schedule data
function extractProbablePitchersFromSchedule(scheduleData: any, game: any, teamIdMapping: Map<number, number>) {
  const lineups: any[] = [];
  
  if (!scheduleData?.dates?.[0]?.games) {
    return lineups;
  }

  // Find the specific game in the schedule
  const scheduleGame = scheduleData.dates[0].games.find((g: any) => g.gamePk === game.game_id);
  
  if (!scheduleGame) {
    console.log(`Game ${game.game_id} not found in schedule data`);
    return lineups;
  }

  // Extract probable pitchers
  if (scheduleGame.teams?.home?.probablePitcher) {
    const homePitcher = scheduleGame.teams.home.probablePitcher;
    const homeTeamId = teamIdMapping.get(scheduleGame.teams.home.team.id);
    
    if (homeTeamId) {
      lineups.push({
        game_id: game.game_id,
        team_id: homeTeamId,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: homePitcher.id,
        player_name: homePitcher.fullName,
        position: 'SP',
        handedness: homePitcher.pitchHand?.code || 'R',
        is_starter: true
      });
    }
  }

  if (scheduleGame.teams?.away?.probablePitcher) {
    const awayPitcher = scheduleGame.teams.away.probablePitcher;
    const awayTeamId = teamIdMapping.get(scheduleGame.teams.away.team.id);
    
    if (awayTeamId) {
      lineups.push({
        game_id: game.game_id,
        team_id: awayTeamId,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: awayPitcher.id,
        player_name: awayPitcher.fullName,
        position: 'SP',
        handedness: awayPitcher.pitchHand?.code || 'R',
        is_starter: true
      });
    }
  }

  return lineups;
}

// Create realistic test lineup for specific games (Cubs vs Twins example)
function createRealisticTestLineupForGame(gameId: number, gameData: any) {
  const lineups: any[] = [];
  
  // Special case for Cubs vs Twins game (777166)
  if (gameId === 777166) {
    return createCubsTwinsTestLineup();
  }
  
  // Special case for Mets vs Orioles game (777165)
  if (gameId === 777165) {
    return createMetsOriolesTestLineup();
  }
  
  // Generic test lineup for other allowed games
  const homeTeamId = gameData.home_team_id;
  const awayTeamId = gameData.away_team_id;
  const homeTeamAbbr = gameData.home_team?.abbreviation || 'HOME';
  const awayTeamAbbr = gameData.away_team?.abbreviation || 'AWAY';
  
  // Generic batting lineups
  const battingOrder = [
    { position: 'CF', handedness: 'L' },
    { position: 'SS', handedness: 'R' },
    { position: 'RF', handedness: 'L' },
    { position: '1B', handedness: 'R' },
    { position: 'DH', handedness: 'L' },
    { position: 'LF', handedness: 'R' },
    { position: '3B', handedness: 'S' },
    { position: 'C', handedness: 'R' },
    { position: '2B', handedness: 'L' }
  ];
  
  // Create batting lineups for both teams
  [{ id: awayTeamId, abbr: awayTeamAbbr, type: 'Away' }, { id: homeTeamId, abbr: homeTeamAbbr, type: 'Home' }].forEach((team, teamIndex) => {
    battingOrder.forEach((spot, index) => {
      lineups.push({
        game_id: gameId,
        team_id: team.id,
        lineup_type: 'batting',
        batting_order: index + 1,
        player_id: 700000 + (teamIndex * 100) + index,
        player_name: `${spot.position} Player (${team.abbr})`,
        position: spot.position,
        handedness: spot.handedness,
        is_starter: true
      });
    });
    
    // Add starting pitcher
    lineups.push({
      game_id: gameId,
      team_id: team.id,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 700200 + teamIndex,
      player_name: `Starting Pitcher (${team.abbr})`,
      position: 'SP',
      handedness: Math.random() > 0.3 ? 'R' : 'L',
      is_starter: true
    });
  });
  
  console.log(`Created realistic test lineup for game ${gameId}: ${lineups.length} entries`);
  return lineups;
}

// Create test lineup for Cubs vs Twins game (777166)
function createCubsTwinsTestLineup() {
  const gameId = 777166;
  const cubsTeamId = 127; // CHC (database ID)
  const twinsTeamId = 126; // MIN (database ID)
  
  const lineups: any[] = [];
  
  // Cubs lineup (away team) - typical Cubs batting order
  const cubsLineup = [
    { name: 'N. Hoerner', position: '2B', handedness: 'R' },
    { name: 'C. Bellinger', position: 'CF', handedness: 'L' },
    { name: 'I. Paredes', position: '3B', handedness: 'R' },
    { name: 'S. Suzuki', position: 'RF', handedness: 'R' },
    { name: 'P. Crow-Armstrong', position: 'LF', handedness: 'L' },
    { name: 'D. Swanson', position: 'SS', handedness: 'R' },
    { name: 'M. Busch', position: '1B', handedness: 'L' },
    { name: 'M. Amaya', position: 'C', handedness: 'R' },
    { name: 'C. Rea', position: 'DH', handedness: 'R' }
  ];
  
  // Twins lineup (home team) - typical Twins batting order
  const twinsLineup = [
    { name: 'C. Correa', position: 'SS', handedness: 'R' },
    { name: 'R. Lewis Jr.', position: '3B', handedness: 'R' },
    { name: 'M. Wallner', position: 'LF', handedness: 'L' },
    { name: 'T. Larnach', position: 'RF', handedness: 'L' },
    { name: 'W. Castro', position: '2B', handedness: 'S' },
    { name: 'C. Julien', position: '1B', handedness: 'R' },
    { name: 'B. Lee', position: 'CF', handedness: 'L' },
    { name: 'R. Jeffers', position: 'C', handedness: 'R' },
    { name: 'E. Farmer', position: 'DH', handedness: 'R' }
  ];
  
  // Add Cubs batting lineup
  cubsLineup.forEach((player, index) => {
    lineups.push({
      game_id: gameId,
      team_id: cubsTeamId,
      lineup_type: 'batting',
      batting_order: index + 1,
      player_id: 650000 + index,
      player_name: player.name,
      position: player.position,
      handedness: player.handedness,
      is_starter: true
    });
  });
  
  // Add Twins batting lineup
  twinsLineup.forEach((player, index) => {
    lineups.push({
      game_id: gameId,
      team_id: twinsTeamId,
      lineup_type: 'batting',
      batting_order: index + 1,
      player_id: 650100 + index,
      player_name: player.name,
      position: player.position,
      handedness: player.handedness,
      is_starter: true
    });
  });
  
  // Add probable pitchers
  lineups.push({
    game_id: gameId,
    team_id: cubsTeamId,
    lineup_type: 'pitching',
    batting_order: null,
    player_id: 650200,
    player_name: 'Shota Imanaga',
    position: 'SP',
    handedness: 'L',
    is_starter: true
  });
  
  lineups.push({
    game_id: gameId,
    team_id: twinsTeamId,
    lineup_type: 'pitching',
    batting_order: null,
    player_id: 650201,
    player_name: 'Pablo López',
    position: 'SP',
    handedness: 'R',
    is_starter: true
  });
  
  console.log(`Created realistic Cubs vs Twins lineup: ${lineups.length} entries`);
  return lineups;
}

// Create test lineup for Mets vs Orioles game based on the image
function createMetsOriolesTestLineup() {
  const gameId = 777165;
  const metsTeamId = 123; // NYM (database ID)
  const oriolesTeamId = 122; // BAL (database ID)
  
  const lineups: any[] = [];
  
  // Mets lineup (away team)
  const metsLineup = [
    { name: 'B. Nimmo', position: 'LF', handedness: 'L' },
    { name: 'F. Lindor', position: 'SS', handedness: 'S' },
    { name: 'Juan Soto', position: 'RF', handedness: 'L' },
    { name: 'Pete Alonso', position: '1B', handedness: 'R' },
    { name: 'Jesse Winker', position: 'DH', handedness: 'L' },
    { name: 'Jeff McNeil', position: 'CF', handedness: 'L' },
    { name: 'R. Mauricio', position: '3B', handedness: 'S' },
    { name: 'Luis Torrens', position: 'C', handedness: 'R' },
    { name: 'Brett Baty', position: '2B', handedness: 'L' }
  ];
  
  // Orioles lineup (home team)
  const oriolesLineup = [
    { name: 'J. Holliday', position: '2B', handedness: 'L' },
    { name: 'J. Westburg', position: '3B', handedness: 'R' },
    { name: 'G. Henderson', position: 'SS', handedness: 'L' },
    { name: 'Ryan Mountcastle', position: '1B', handedness: 'R' },
    { name: 'R. Laureano', position: 'RF', handedness: 'R' },
    { name: 'C. Cowser', position: 'LF', handedness: 'L' },
    { name: "T. O'Neill", position: 'DH', handedness: 'R' },
    { name: 'C. Mullins', position: 'CF', handedness: 'L' },
    { name: 'J. Stallings', position: 'C', handedness: 'R' }
  ];
  
  // Add Mets batting lineup
  metsLineup.forEach((player, index) => {
    lineups.push({
      game_id: gameId,
      team_id: metsTeamId,
      lineup_type: 'batting',
      batting_order: index + 1,
      player_id: 600000 + index,
      player_name: player.name,
      position: player.position,
      handedness: player.handedness,
      is_starter: true
    });
  });
  
  // Add Orioles batting lineup
  oriolesLineup.forEach((player, index) => {
    lineups.push({
      game_id: gameId,
      team_id: oriolesTeamId,
      lineup_type: 'batting',
      batting_order: index + 1,
      player_id: 600100 + index,
      player_name: player.name,
      position: player.position,
      handedness: player.handedness,
      is_starter: true
    });
  });
  
  // Add probable pitchers
  lineups.push({
    game_id: gameId,
    team_id: metsTeamId,
    lineup_type: 'pitching',
    batting_order: null,
    player_id: 600200,
    player_name: 'David Peterson',
    position: 'SP',
    handedness: 'L',
    is_starter: true
  });
  
  lineups.push({
    game_id: gameId,
    team_id: oriolesTeamId,
    lineup_type: 'pitching',
    batting_order: null,
    player_id: 600201,
    player_name: 'Charlie Morton',
    position: 'SP',
    handedness: 'R',
    is_starter: true
  });
  
  console.log(`Created realistic Mets vs Orioles lineup: ${lineups.length} entries`);
  return lineups;
}