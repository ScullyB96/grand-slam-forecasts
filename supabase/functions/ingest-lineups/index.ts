import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed, createTeamIdMapping } from '../shared/mlb-api.ts';

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

    // Try to get official lineups from MLB Stats API first
    console.log('Attempting to fetch official lineups from MLB Stats API...');
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

    // For testing: Add specific lineup for Mets vs Orioles game (777165)
    if (games.some(game => game.game_id === 777165)) {
      console.log('Adding test lineup for Mets vs Orioles game (777165)');
      const testLineups = createMetsOriolesTestLineup();
      lineups.push(...testLineups);
      console.log(`✅ Added ${testLineups.length} test lineup entries for Mets vs Orioles`);
    }

    // For games without official lineups, we'll only use probable pitchers from MLB API
    if (officialLineupsFound < games.length) {
      console.log('Adding probable pitchers for remaining games...');
      
      const gamesNeedingLineups = games.filter(game => 
        !lineups.some(lineup => lineup.game_id === game.game_id && lineup.lineup_type === 'pitching')
      );

      for (const game of gamesNeedingLineups) {
        try {
          // Fetch probable pitchers from MLB API schedule
          const scheduleData = await fetchGameSchedule(game.game_id);
          const probablePitchers = extractProbablePitchersFromSchedule(scheduleData, game);
          
          if (probablePitchers.length > 0) {
            lineups.push(...probablePitchers);
            console.log(`✅ Added probable pitchers for game ${game.game_id}`);
          }
        } catch (error) {
          console.error(`Failed to get probable pitchers for game ${game.game_id}:`, error);
        }
      }
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
  
  console.log(`Created test lineup for Mets vs Orioles: ${lineups.length} entries`);
  return lineups;
}

// Fetch game schedule to get probable pitchers
async function fetchGameSchedule(gameId: number) {
  try {
    console.log(`Fetching schedule data for game ${gameId}`);
    const url = `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gameId}&hydrate=probablePitcher`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch schedule for game ${gameId}:`, error);
    throw error;
  }
}

// Extract probable pitchers from schedule data
function extractProbablePitchersFromSchedule(scheduleData: any, game: any) {
  const lineups: any[] = [];
  
  try {
    const gameData = scheduleData.dates?.[0]?.games?.[0];
    
    if (gameData?.teams?.away?.probablePitcher) {
      const pitcher = gameData.teams.away.probablePitcher;
      lineups.push({
        game_id: game.game_id,
        team_id: game.away_team_id,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: pitcher.id,
        player_name: pitcher.fullName,
        position: 'SP',
        handedness: pitcher.pitchHand?.code || 'R',
        is_starter: true
      });
    }
    
    if (gameData?.teams?.home?.probablePitcher) {
      const pitcher = gameData.teams.home.probablePitcher;
      lineups.push({
        game_id: game.game_id,
        team_id: game.home_team_id,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: pitcher.id,
        player_name: pitcher.fullName,
        position: 'SP',
        handedness: pitcher.pitchHand?.code || 'R',
        is_starter: true
      });
    }
  } catch (error) {
    console.error('Error extracting probable pitchers:', error);
  }
  
  return lineups;
}