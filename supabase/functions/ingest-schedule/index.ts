
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

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
  league: {
    name: string;
    abbreviation: string;
  };
  division: {
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
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,venue`;
  console.log(`Fetching MLB schedule for ${date} from: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
  }
  
  const data: MLBScheduleResponse = await response.json();
  console.log(`MLB API returned ${data.dates.length} date(s)`);
  
  return data.dates.flatMap(dateEntry => dateEntry.games);
}

async function upsertTeam(supabase: any, team: MLBTeam) {
  const teamData = {
    team_id: team.id,
    name: team.teamName || team.clubName || team.name,
    abbreviation: team.abbreviation || team.name.substring(0, 3).toUpperCase(),
    league: team.league.abbreviation,
    division: team.division.nameShort,
    city: team.teamName ? team.name : undefined,
    venue_name: team.venue?.name
  };

  const { error } = await supabase
    .from('teams')
    .upsert(teamData, { 
      onConflict: 'team_id',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error(`Error upserting team ${team.id}:`, error);
    throw error;
  }

  // Get the internal ID for the team
  const { data: teamRecord, error: selectError } = await supabase
    .from('teams')
    .select('id')
    .eq('team_id', team.id)
    .single();

  if (selectError) {
    console.error(`Error fetching team ID for ${team.id}:`, selectError);
    throw selectError;
  }

  return teamRecord.id;
}

async function processGames(supabase: any, games: MLBGame[]) {
  let processedCount = 0;
  const errors: string[] = [];

  for (const game of games) {
    try {
      // First ensure both teams exist and get their internal IDs
      const homeTeamId = await upsertTeam(supabase, game.teams.home.team);
      const awayTeamId = await upsertTeam(supabase, game.teams.away.team);

      // Parse game date and time
      const gameDateTime = new Date(game.gameDate);
      const gameDate = gameDateTime.toISOString().split('T')[0];
      const gameTime = gameDateTime.toTimeString().split(' ')[0];

      // Map status
      let status = 'scheduled';
      const mlbStatus = game.status.detailedState.toLowerCase();
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

      const { error } = await supabase
        .from('games')
        .upsert(gameData, { 
          onConflict: 'game_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting game ${game.gamePk}:`, error);
        errors.push(`Game ${game.gamePk}: ${error.message}`);
      } else {
        processedCount++;
        console.log(`Successfully processed game ${game.gamePk}`);
      }
    } catch (error) {
      console.error(`Error processing game ${game.gamePk}:`, error);
      errors.push(`Game ${game.gamePk}: ${error.message}`);
    }
  }

  return { processedCount, errors };
}

async function logIngestionJob(supabase: any, jobData: any) {
  const { error } = await supabase
    .from('data_ingestion_jobs')
    .insert(jobData);

  if (error) {
    console.error('Error logging ingestion job:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get date parameter or use today
    const url = new URL(req.url);
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
    console.log(`Fetched ${games.length} games for ${targetDate}`);

    // Process and upsert games
    const { processedCount, errors } = await processGames(supabase, games);

    const completedAt = new Date();
    const success = errors.length === 0;

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
      success: true,
      date: targetDate,
      gamesFound: games.length,
      gamesProcessed: processedCount,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      duration: completedAt.getTime() - startTime.getTime()
    };

    console.log('Ingestion completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: success ? 200 : 207 // 207 Multi-Status for partial success
    });

  } catch (error) {
    console.error('Ingestion failed:', error);

    // Log job failure
    await logIngestionJob(supabase, {
      job_name: 'MLB Schedule Ingestion',
      job_type: 'schedule_ingestion',
      data_source: 'MLB Stats API',
      status: 'failed',
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
      errors_count: 1,
      error_details: { error: error.message }
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
