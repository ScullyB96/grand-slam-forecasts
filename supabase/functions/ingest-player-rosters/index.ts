import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1';

// Rate limiting
const RATE_LIMIT_DELAY = 150;
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

async function makeMLBRequest(endpoint: string, params: Record<string, any> = {}) {
  await rateLimit();
  
  const url = new URL(`${MLB_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  console.log(`MLB API Request: ${url.toString()}`);
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} - ${response.statusText}`);
  }
  
  return response.json();
}

async function getTeamRoster(teamId: number, season: number) {
  console.log(`Fetching roster for team ${teamId}, season ${season}`);
  
  return await makeMLBRequest(`/teams/${teamId}/roster`, {
    season,
    rosterType: 'fullSeason'
  });
}

serve(async (req) => {
  console.log('=== PLAYER ROSTER INGESTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json();
    const { season = new Date().getFullYear(), teamIds = null, force = false } = requestBody;

    console.log('Roster ingestion request:', { season, teamIds, force });

    // Create ingestion job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-player-rosters',
        job_type: 'player_rosters',
        status: 'running',
        started_at: new Date().toISOString(),
        season,
        data_source: 'MLB Stats API'
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      throw jobError;
    }

    const jobId = jobRecord.id;
    console.log('Created roster ingestion job with ID:', jobId);

    // Get all teams if teamIds not specified
    let teams;
    if (teamIds) {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('team_id', teamIds);
      
      if (teamsError) throw teamsError;
      teams = teamsData;
    } else {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*');
      
      if (teamsError) throw teamsError;
      teams = teamsData;
    }

    console.log(`Processing rosters for ${teams.length} teams`);

    const results = {
      teamsProcessed: 0,
      playersInserted: 0,
      playersUpdated: 0,
      errors: [] as string[]
    };

    // Process each team
    for (const team of teams) {
      if (!team.team_id) {
        console.log(`Skipping team ${team.name} - no MLB team ID`);
        continue;
      }

      try {
        console.log(`\n=== Processing roster for ${team.name} (${team.team_id}) ===`);
        
        const rosterData = await getTeamRoster(team.team_id, season);
        
        if (!rosterData?.roster) {
          console.log(`No roster data for ${team.name}`);
          continue;
        }

        // Process each player
        for (const playerEntry of rosterData.roster) {
          const player = playerEntry.person;
          const position = playerEntry.position;
          
          if (!player?.id) continue;

          const playerData = {
            player_id: player.id,
            full_name: player.fullName || '',
            first_name: player.firstName || null,
            last_name: player.lastName || null,
            position: position?.abbreviation || null,
            team_id: team.id,
            batting_hand: player.batSide?.code || null,
            pitching_hand: player.pitchHand?.code || null,
            birth_date: player.birthDate || null,
            height_inches: player.height ? parseInt(player.height.replace(/[^0-9]/g, '')) : null,
            weight_pounds: player.weight || null,
            jersey_number: playerEntry.jerseyNumber || null,
            active: true
          };

          // Try to upsert player
          const { data: existingPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('player_id', player.id)
            .maybeSingle();

          if (existingPlayer) {
            // Update existing player
            const { error: updateError } = await supabase
              .from('players')
              .update(playerData)
              .eq('player_id', player.id);

            if (updateError) {
              console.error(`Error updating player ${player.fullName}:`, updateError);
              results.errors.push(`Update ${player.fullName}: ${updateError.message}`);
            } else {
              results.playersUpdated++;
              console.log(`✅ Updated player: ${player.fullName}`);
            }
          } else {
            // Insert new player
            const { error: insertError } = await supabase
              .from('players')
              .insert(playerData);

            if (insertError) {
              console.error(`Error inserting player ${player.fullName}:`, insertError);
              results.errors.push(`Insert ${player.fullName}: ${insertError.message}`);
            } else {
              results.playersInserted++;
              console.log(`✅ Inserted player: ${player.fullName}`);
            }
          }
        }

        results.teamsProcessed++;
        console.log(`✅ Completed roster for ${team.name}: ${rosterData.roster.length} players`);

      } catch (error) {
        console.error(`Error processing team ${team.name}:`, error);
        results.errors.push(`Team ${team.name}: ${error.message}`);
      }
    }

    // Update job completion
    const success = results.errors.length === 0;
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: success ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString(),
        records_processed: results.teamsProcessed,
        records_inserted: results.playersInserted,
        records_updated: results.playersUpdated,
        errors_count: results.errors.length,
        error_details: results.errors.length > 0 ? { errors: results.errors } : null
      })
      .eq('id', jobId);

    console.log('=== ROSTER INGESTION COMPLETED ===');
    console.log('Results:', results);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      ...results,
      message: `Processed ${results.teamsProcessed} teams, inserted ${results.playersInserted} players, updated ${results.playersUpdated} players`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Roster ingestion failed:', error);
    
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