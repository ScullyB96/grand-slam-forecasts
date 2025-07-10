
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MLBTeam {
  id: number;
  name: string;
  abbreviation?: string;
  teamName?: string;
  clubName?: string;
  league?: {
    name: string;
    abbreviation: string;
  };
  division?: {
    name: string;
    nameShort: string;
  };
  venue?: {
    name: string;
  };
}

interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: {
    detailedState: string;
  };
  teams: {
    home: {
      team: MLBTeam;
      score?: number;
    };
    away: {
      team: MLBTeam;
      score?: number;
    };
  };
  venue?: {
    name: string;
  };
}

interface MLBScheduleResponse {
  dates: Array<{
    games: MLBGame[];
  }>;
}

async function fetchMLBSchedule(date: string): Promise<MLBGame[]> {
  // Ensure date is in YYYY-MM-DD format
  const formattedDate = date.split('T')[0]; // Remove time component if present
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${formattedDate}&hydrate=team,venue`;
  
  console.log(`Fetching MLB schedule for ${formattedDate}`, { url });
  
  try {
    const response = await fetch(url);
    console.log(`MLB API HTTP Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MLB API error: ${response.status} ${response.statusText}`, { errorText });
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
    }
    
    const data: MLBScheduleResponse = await response.json();
    console.log(`MLB API Response Structure`, { 
      datesCount: data.dates?.length || 0,
      rawData: JSON.stringify(data, null, 2).substring(0, 1000) // Log first 1000 chars of response
    });
    
    if (!data.dates || !Array.isArray(data.dates)) {
      console.error('Invalid API response structure - no dates array', data);
      throw new Error('Invalid API response structure: missing dates array');
    }
    
    const games = data.dates.flatMap(dateEntry => {
      if (!dateEntry.games || !Array.isArray(dateEntry.games)) {
        console.warn('Date entry missing games array', dateEntry);
        return [];
      }
      return dateEntry.games;
    });
    
    console.log(`Successfully fetched ${games.length} games from MLB API`);
    
    // Check for duplicate game IDs
    const gameIds = games.map(g => g.gamePk);
    const uniqueIds = new Set(gameIds);
    if (gameIds.length !== uniqueIds.size) {
      console.warn('Duplicate game IDs detected!', {
        totalGames: gameIds.length,
        uniqueGames: uniqueIds.size,
        gameIds: gameIds
      });
    }
    
    // Log sample game structure for debugging
    if (games.length > 0) {
      console.log('Sample game structure:', JSON.stringify(games[0], null, 2));
    }
    
    return games;
  } catch (error) {
    console.error(`Failed to fetch MLB schedule`, { 
      error: error.message,
      stack: error.stack,
      url,
      date: formattedDate
    });
    throw error;
  }
}

async function validateTeamData(team: MLBTeam): Promise<boolean> {
  if (!team || typeof team !== 'object') {
    console.error('Invalid team data: not an object', team);
    return false;
  }
  
  if (!team.id || typeof team.id !== 'number') {
    console.error('Invalid team data: missing or invalid id', team);
    return false;
  }
  
  if (!team.name && !team.teamName && !team.clubName) {
    console.error('Invalid team data: no name fields', team);
    return false;
  }
  
  return true;
}

async function upsertTeam(supabase: any, team: MLBTeam) {
  try {
    // Validate team data first
    if (!(await validateTeamData(team))) {
      throw new Error(`Invalid team data for team ID ${team.id}`);
    }

    // Handle different team name structures from MLB API
    const teamName = team.teamName || team.clubName || team.name;
    const abbreviation = team.abbreviation || teamName?.substring(0, 3).toUpperCase() || 'UNK';
    const league = team.league?.abbreviation || 'MLB';
    
    // Handle division names more carefully
    let division = 'Unknown';
    if (team.division?.nameShort) {
      division = team.division.nameShort;
    } else if (team.division?.name) {
      // Map full division names to short names
      const divisionMap: { [key: string]: string } = {
        'American League East': 'ALE',
        'American League Central': 'ALC', 
        'American League West': 'ALW',
        'National League East': 'NLE',
        'National League Central': 'NLC',
        'National League West': 'NLW'
      };
      division = divisionMap[team.division.name] || team.division.name.substring(0, 3).toUpperCase();
    }

    const teamData = {
      team_id: team.id,
      name: teamName,
      abbreviation: abbreviation,
      league: league,
      division: division,
      city: team.teamName ? team.name : undefined,
      venue_name: team.venue?.name
    };

    console.log(`Upserting team ${team.id}`, teamData);

    const { error } = await supabase
      .from('teams')
      .upsert(teamData, { 
        onConflict: 'team_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`Error upserting team ${team.id}`, error);
      throw error;
    }

    // Get the internal ID for the team
    const { data: teamRecord, error: selectError } = await supabase
      .from('teams')
      .select('id')
      .eq('team_id', team.id)
      .single();

    if (selectError) {
      console.error(`Error fetching team ID for ${team.id}`, selectError);
      throw selectError;
    }

    console.log(`Successfully upserted team ${team.id} with internal ID ${teamRecord.id}`);
    return teamRecord.id;
  } catch (error) {
    console.error(`Failed to upsert team ${team.id}`, { 
      error: error.message, 
      team: JSON.stringify(team, null, 2) 
    });
    throw error;
  }
}

async function validateGameData(game: MLBGame): Promise<boolean> {
  if (!game || typeof game !== 'object') {
    console.error('Invalid game data: not an object', game);
    return false;
  }
  
  if (!game.gamePk || typeof game.gamePk !== 'number') {
    console.error('Invalid game data: missing gamePk', game);
    return false;
  }
  
  if (!game.gameDate) {
    console.error('Invalid game data: missing gameDate', game);
    return false;
  }
  
  if (!game.teams?.home?.team || !game.teams?.away?.team) {
    console.error('Invalid game data: missing team information', game);
    return false;
  }
  
  return true;
}

async function processGames(supabase: any, games: MLBGame[]) {
  let processedCount = 0;
  const errors: string[] = [];

  console.log(`Starting to process ${games.length} games`);

  for (const [index, game] of games.entries()) {
    try {
      console.log(`Processing game ${index + 1}/${games.length}: ${game.gamePk}`);
      
      // Validate game structure
      if (!(await validateGameData(game))) {
        const error = `Game ${game.gamePk}: Invalid game structure`;
        console.error(error);
        errors.push(error);
        continue;
      }

      // First ensure both teams exist and get their internal IDs
      console.log(`Processing teams for game ${game.gamePk}`);
      const homeTeamId = await upsertTeam(supabase, game.teams.home.team);
      const awayTeamId = await upsertTeam(supabase, game.teams.away.team);

      // Parse game date and time with better error handling
      let gameDateTime: Date;
      try {
        gameDateTime = new Date(game.gameDate);
        if (isNaN(gameDateTime.getTime())) {
          throw new Error(`Invalid date: ${game.gameDate}`);
        }
      } catch (dateError) {
        console.error(`Invalid game date for game ${game.gamePk}: ${game.gameDate}`, dateError);
        errors.push(`Game ${game.gamePk}: Invalid date format`);
        continue;
      }
      
      const gameDate = gameDateTime.toISOString().split('T')[0];
      // Format time in EST/EDT timezone properly
      const gameTime = gameDateTime.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Map status with more robust handling
      let status = 'scheduled';
      const mlbStatus = game.status?.detailedState?.toLowerCase() || '';
      if (mlbStatus.includes('live') || mlbStatus.includes('progress') || mlbStatus.includes('in progress')) {
        status = 'live';
      } else if (mlbStatus.includes('final') || mlbStatus.includes('completed') || mlbStatus.includes('game over')) {
        status = 'final';
      } else if (mlbStatus.includes('postponed') || mlbStatus.includes('delayed')) {
        status = 'postponed';
      } else if (mlbStatus.includes('cancelled') || mlbStatus.includes('canceled')) {
        status = 'cancelled';
      }

      const gameData = {
        game_id: game.gamePk,
        game_date: gameDate,
        game_time: gameTime,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        venue_name: game.venue?.name,
        status: status,
        home_score: game.teams.home.score,
        away_score: game.teams.away.score
      };

      console.log(`Upserting game ${game.gamePk}`, gameData);

      const { error } = await supabase
        .from('games')
        .upsert(gameData, { 
          onConflict: 'game_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting game ${game.gamePk}`, error);
        console.error(`Game data that failed:`, JSON.stringify(gameData, null, 2));
        errors.push(`Game ${game.gamePk}: ${error.message}`);
      } else {
        processedCount++;
        console.log(`Successfully processed game ${game.gamePk} (${processedCount}/${games.length})`);
      }
    } catch (error) {
      console.error(`Error processing game ${game.gamePk}`, { 
        error: error.message, 
        stack: error.stack,
        gameData: JSON.stringify(game, null, 2).substring(0, 500)
      });
      errors.push(`Game ${game.gamePk}: ${error.message}`);
    }
  }

  console.log(`Completed processing games`, { 
    total: games.length, 
    successful: processedCount, 
    errors: errors.length 
  });

  return { processedCount, errors };
}

async function verifyIngestion(supabase: any, targetDate: string) {
  try {
    console.log(`Verifying ingestion for date: ${targetDate}`);
    
    const { data: games, error } = await supabase
      .from('games')
      .select('game_id, status')
      .eq('game_date', targetDate);

    if (error) {
      console.error('Failed to verify ingestion', error);
      throw error;
    }

    const gameCount = games?.length || 0;
    console.log(`Verification complete: Found ${gameCount} games for ${targetDate}`);
    console.log('Game IDs found:', games?.map((g: any) => g.game_id) || []);
    
    return { success: gameCount > 0, gameCount, gameIds: games?.map((g: any) => g.game_id) || [] };
  } catch (error) {
    console.error('Verification process failed', { error: error.message });
    return { success: false, gameCount: 0, error: error.message };
  }
}

async function logIngestionJob(supabase: any, jobData: any) {
  try {
    const { error } = await supabase
      .from('data_ingestion_jobs')
      .insert(jobData);

    if (error) {
      console.error('Error logging ingestion job', error);
    } else {
      console.log('Successfully logged ingestion job', { jobId: jobData.id });
    }
  } catch (error) {
    console.error('Failed to log ingestion job', { error: error.message });
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Debug endpoint
  if (url.pathname.includes('/debug-schedule')) {
    console.log('Debug endpoint accessed');
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: lastJob, error } = await supabase
        .from('data_ingestion_jobs')
        .select('*')
        .eq('job_name', 'MLB Schedule Ingestion')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        lastJob: lastJob?.[0] || null,
        summary: {
          hasData: !!lastJob?.[0],
          lastRun: lastJob?.[0]?.created_at || null,
          status: lastJob?.[0]?.status || 'unknown'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  // Main ingestion endpoint
  const startTime = new Date();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get date parameter or use today
    const dateParam = url.searchParams.get('date');
    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    console.log(`Starting MLB schedule ingestion for ${targetDate}`);

    // Log job start
    const jobId = crypto.randomUUID();
    await logIngestionJob(supabase, {
      id: jobId,
      job_name: 'MLB Schedule Ingestion',
      job_type: 'schedule_ingestion',
      data_source: 'MLB Stats API',
      status: 'running',
      started_at: startTime.toISOString(),
      season: new Date(targetDate).getFullYear()
    });

    // Fetch games from MLB API
    const games = await fetchMLBSchedule(targetDate);

    if (games.length === 0) {
      console.log('No games found for the specified date');
      
      // Log completion with no games
      await logIngestionJob(supabase, {
        id: jobId,
        job_name: 'MLB Schedule Ingestion',
        job_type: 'schedule_ingestion',
        data_source: 'MLB Stats API',
        status: 'completed',
        started_at: startTime.toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: 0,
        records_inserted: 0,
        errors_count: 0,
        season: new Date(targetDate).getFullYear()
      });

      return new Response(JSON.stringify({
        success: true,
        date: targetDate,
        gamesFound: 0,
        gamesProcessed: 0,
        verification: { success: true, gameCount: 0 },
        errors: 0,
        duration: new Date().getTime() - startTime.getTime(),
        message: 'No games scheduled for this date'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Process and upsert games
    const { processedCount, errors } = await processGames(supabase, games);

    // Verify ingestion
    const verification = await verifyIngestion(supabase, targetDate);

    const completedAt = new Date();
    const success = errors.length === 0 && processedCount > 0;

    // Log job completion
    await logIngestionJob(supabase, {
      id: jobId,
      job_name: 'MLB Schedule Ingestion',
      job_type: 'schedule_ingestion',
      data_source: 'MLB Stats API',
      status: success ? 'completed' : 'completed_with_errors',
      started_at: startTime.toISOString(),
      completed_at: completedAt.toISOString(),
      records_processed: games.length,
      records_inserted: processedCount,
      errors_count: errors.length,
      error_details: errors.length > 0 ? { errors } : null,
      season: new Date(targetDate).getFullYear()
    });

    const response = {
      success: success,
      date: targetDate,
      gamesFound: games.length,
      gamesProcessed: processedCount,
      verification: verification,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      duration: completedAt.getTime() - startTime.getTime()
    };

    console.log('Ingestion completed', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: success ? 200 : 207 // 207 Multi-Status for partial success
    });

  } catch (error) {
    console.error('Ingestion failed catastrophically', { error: error.message, stack: error.stack });

    // Log job failure
    const jobId = crypto.randomUUID();
    await logIngestionJob(supabase, {
      id: jobId,
      job_name: 'MLB Schedule Ingestion',
      job_type: 'schedule_ingestion',
      data_source: 'MLB Stats API',
      status: 'failed',
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
      errors_count: 1,
      error_details: { error: error.message, stack: error.stack },
      season: new Date().getFullYear()
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
