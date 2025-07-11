import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== STATCAST DATA INGESTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let jobId: number | null = null;

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { season = 2025, playerIds } = requestBody;

    console.log(`Starting Statcast ingestion for season ${season}`);
    
    // Create ingestion job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-statcast-data',
        job_type: 'statcast',
        status: 'running',
        season: season,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobError) {
      throw new Error('Failed to create job: ' + jobError.message);
    }
    
    jobId = jobRecord.id;
    console.log(`Created job ${jobId} for Statcast ingestion`);

    // Get active players if no specific playerIds provided
    let playersToProcess = [];
    if (playerIds && playerIds.length > 0) {
      playersToProcess = playerIds.map((id: number) => ({ player_id: id }));
    } else {
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('player_id, team_id')
        .eq('active', true)
        .limit(50); // Process in batches

      if (playersError) {
        throw new Error('Failed to fetch players: ' + playersError.message);
      }
      
      playersToProcess = players || [];
    }

    console.log(`Processing ${playersToProcess.length} players`);

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each player
    for (const player of playersToProcess) {
      try {
        await ingestPlayerStatcastData(supabase, player.player_id, season);
        processed++;
        console.log(`✅ Processed player ${player.player_id}`);
      } catch (playerError) {
        console.error(`❌ Error processing player ${player.player_id}:`, playerError);
        errors++;
        errorDetails.push(`Player ${player.player_id}: ${playerError.message}`);
      }
    }

    // Complete job
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: playersToProcess.length,
        records_inserted: processed,
        errors_count: errors,
        error_details: errorDetails.length > 0 ? { errors: errorDetails } : null
      })
      .eq('id', jobId);

    console.log(`✅ Statcast ingestion completed: ${processed} processed, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_players: playersToProcess.length,
      message: `Processed ${processed} players with ${errors} errors`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Statcast ingestion failed:', error);
    
    if (jobId) {
      await supabase
        .from('data_ingestion_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { error: error.message }
        })
        .eq('id', jobId);
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

async function ingestPlayerStatcastData(supabase: any, playerId: number, season: number) {
  console.log(`Fetching Statcast data for player ${playerId}, season ${season}`);
  
  // Fetch player stats with explicit season and statcast group
  const statsUrl = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${season}&group=statcast`;
  
  const response = await fetch(statsUrl);
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.stats || data.stats.length === 0) {
    console.log(`No Statcast data found for player ${playerId} in ${season}`);
    return;
  }

  // Extract Statcast metrics from the response
  const statcastStats = data.stats[0]?.splits?.[0]?.stat;
  if (!statcastStats) {
    console.log(`No Statcast stats in response for player ${playerId}`);
    return;
  }

  // Prepare the upsert data
  const statcastData = {
    player_id: playerId,
    season: season,
    team_id: data.people?.[0]?.currentTeam?.id || null,
    
    // Batting Statcast metrics
    avg_exit_velocity: parseFloat(statcastStats.avgExitVelo) || null,
    max_exit_velocity: parseFloat(statcastStats.maxExitVelo) || null,
    avg_launch_angle: parseFloat(statcastStats.avgLaunchAngle) || null,
    barrel_pct: parseFloat(statcastStats.barrelPct) || null,
    hard_hit_pct: parseFloat(statcastStats.hardHitPct) || null,
    xba: parseFloat(statcastStats.xba) || null,
    xslg: parseFloat(statcastStats.xslg) || null,
    xwoba: parseFloat(statcastStats.xwoba) || null,
    xobp: parseFloat(statcastStats.xobp) || null,
    xops: parseFloat(statcastStats.xops) || null,
    sprint_speed: parseFloat(statcastStats.sprintSpeed) || null,
    sweet_spot_pct: parseFloat(statcastStats.sweetSpotPct) || null,
    
    // Pitching Statcast metrics
    avg_fastball_velocity: parseFloat(statcastStats.avgFastballVelo) || null,
    max_fastball_velocity: parseFloat(statcastStats.maxFastballVelo) || null,
    avg_spin_rate: parseInt(statcastStats.avgSpinRate) || null,
    whiff_pct: parseFloat(statcastStats.whiffPct) || null,
    chase_pct: parseFloat(statcastStats.chasePct) || null,
    extension: parseFloat(statcastStats.extension) || null,
    vertical_break: parseFloat(statcastStats.vertBreak) || null,
    horizontal_break: parseFloat(statcastStats.horzBreak) || null,
    
    // Fielding metrics
    outs_above_average: parseFloat(statcastStats.outsAboveAverage) || null,
    
    updated_at: new Date().toISOString()
  };

  // Upsert the data
  const { error } = await supabase
    .from('player_statcast')
    .upsert(statcastData, { 
      onConflict: 'player_id,season',
      ignoreDuplicates: false 
    });

  if (error) {
    throw new Error(`Database upsert error: ${error.message}`);
  }

  console.log(`✅ Upserted Statcast data for player ${playerId}`);
}