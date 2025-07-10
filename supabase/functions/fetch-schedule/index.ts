
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
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  console.log(`Fetching MLB schedule for ${date}`, { url });
  
  try {
    const response = await fetch(url);
    console.log(`MLB API HTTP Status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
    }
    
    const data: MLBScheduleResponse = await response.json();
    console.log(`MLB API Response Structure`, { 
      datesCount: data.dates?.length || 0,
      totalGames: data.dates?.reduce((sum, date) => sum + (date.games?.length || 0), 0) || 0
    });
    
    const games = data.dates?.flatMap(dateEntry => dateEntry.games || []) || [];
    console.log(`Successfully fetched ${games.length} games from MLB API`);
    
    return games;
  } catch (error) {
    console.error(`Failed to fetch MLB schedule`, { 
      error: error.message,
      url,
      date
    });
    throw error;
  }
}

async function upsertTeam(supabase: any, team: MLBTeam) {
  try {
    // Handle different team name structures from MLB API
    const teamName = team.teamName || team.clubName || team.name;
    const abbreviation = team.abbreviation || teamName?.substring(0, 3).toUpperCase() || 'UNK';
    const league = team.league?.abbreviation || 'MLB';
    const division = team.division?.nameShort || 'Unknown';

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
    console.error(`Failed to upsert team ${team.id}`, { error: error.message });
    throw error;
  }
}

async function processGames(supabase: any, games: MLBGame[]) {
  let processedCount = 0;
  const errors: string[] = [];

  console.log(`Starting to process ${games.length} games`);

  for (const game of games) {
    try {
      // Validate game structure
      if (!game.teams?.home?.team || !game.teams?.away?.team) {
        const error = `Game ${game.gamePk}: Invalid team structure`;
        console.error(error);
        errors.push(error);
        continue;
      }

      // First ensure both teams exist and get their internal IDs
      const homeTeamId = await upsertTeam(supabase, game.teams.home.team);
      const awayTeamId = await upsertTeam(supabase, game.teams.away.team);

      // Parse game date and time
      const gameDateTime = new Date(game.gameDate);
      const gameDate = gameDateTime.toISOString().split('T')[0];
      const gameTime = gameDateTime.toTimeString().split(' ')[0];

      // Map status
      let status = 'scheduled';
      const mlbStatus = game.status?.detailedState?.toLowerCase() || '';
      if (mlbStatus.includes('live') || mlbStatus.includes('progress')) {
        status = 'live';
      } else if (mlbStatus.includes('final') || mlbStatus.includes('completed')) {
        status = 'final';
      } else if (mlbStatus.includes('postponed')) {
        status = 'postponed';
      } else if (mlbStatus.includes('cancelled')) {
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
        errors.push(`Game ${game.gamePk}: ${error.message}`);
      } else {
        processedCount++;
        console.log(`Successfully processed game ${game.gamePk}`);
      }
    } catch (error) {
      console.error(`Error processing game ${game.gamePk}`, { error: error.message });
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
      .select('*')
      .eq('game_date', targetDate);

    if (error) {
      console.error('Failed to verify ingestion', error);
      throw error;
    }

    const gameCount = games?.length || 0;
    console.log(`Verification complete: Found ${gameCount} games for ${targetDate}`);
    
    return { success: gameCount > 0, gameCount };
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

    // Process and upsert games
    const { processedCount, errors } = await processGames(supabase, games);

    // Verify ingestion
    const verification = await verifyIngestion(supabase, targetDate);

    const completedAt = new Date();
    const success = errors.length === 0 && verification.success;

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
