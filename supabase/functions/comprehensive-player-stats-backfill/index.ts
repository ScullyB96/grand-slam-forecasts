import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlayerStatsBackfillRequest {
  season?: number;
  teamIds?: number[]; // MLB team IDs
  playerIds?: number[]; // MLB player IDs
  includeRosters?: boolean;
  includeBattingStats?: boolean;
  includePitchingStats?: boolean;
  force?: boolean;
}

serve(async (req) => {
  console.log('=== COMPREHENSIVE PLAYER STATS BACKFILL STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody: PlayerStatsBackfillRequest = await req.json();
    const { 
      season = new Date().getFullYear(),
      teamIds = null,
      playerIds = null,
      includeRosters = true,
      includeBattingStats = true,
      includePitchingStats = true,
      force = false 
    } = requestBody;

    console.log('Player stats backfill request:', { 
      season, teamIds, playerIds, includeRosters, includeBattingStats, includePitchingStats, force 
    });

    // Create main backfill job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'comprehensive-player-stats-backfill',
        job_type: 'player_stats_backfill',
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
    console.log('Created comprehensive player stats backfill job with ID:', jobId);

    const results = {
      season,
      stepsCompleted: 0,
      totalSteps: (includeRosters ? 1 : 0) + (includeBattingStats ? 1 : 0) + (includePitchingStats ? 1 : 0),
      rosterResults: null as any,
      battingResults: null as any,
      pitchingResults: null as any,
      errors: [] as string[]
    };

    // Helper function to call edge functions
    async function callEdgeFunction(functionName: string, params: any) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      try {
        const url = `${supabaseUrl}/functions/v1/${functionName}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': serviceKey
          },
          body: JSON.stringify(params)
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`${functionName} error:`, result);
          return { success: false, error: result.error || `HTTP ${response.status}` };
        }

        return { success: true, ...result };
      } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        return { success: false, error: error.message };
      }
    }

    // Step 1: Ingest player rosters
    if (includeRosters) {
      console.log(`\n=== Step 1: Ingesting Player Rosters for ${season} ===`);
      
      const rosterResult = await callEdgeFunction('ingest-player-rosters', {
        season,
        teamIds,
        force
      });
      
      if (rosterResult.success) {
        results.rosterResults = rosterResult;
        results.stepsCompleted++;
        console.log(`✅ Player rosters completed: ${rosterResult.playersInserted} inserted, ${rosterResult.playersUpdated} updated`);
      } else {
        results.errors.push(`Player rosters: ${rosterResult.error}`);
        console.log(`❌ Player rosters failed: ${rosterResult.error}`);
      }
    }

    // Step 2: Ingest batting statistics
    if (includeBattingStats) {
      console.log(`\n=== Step 2: Ingesting Batting Statistics for ${season} ===`);
      
      const battingResult = await callEdgeFunction('ingest-player-batting-stats', {
        season,
        teamIds,
        playerIds,
        force
      });
      
      if (battingResult.success) {
        results.battingResults = battingResult;
        results.stepsCompleted++;
        console.log(`✅ Batting stats completed: ${battingResult.statsInserted} inserted, ${battingResult.statsUpdated} updated`);
      } else {
        results.errors.push(`Batting stats: ${battingResult.error}`);
        console.log(`❌ Batting stats failed: ${battingResult.error}`);
      }
    }

    // Step 3: Ingest pitching statistics
    if (includePitchingStats) {
      console.log(`\n=== Step 3: Ingesting Pitching Statistics for ${season} ===`);
      
      const pitchingResult = await callEdgeFunction('ingest-player-pitching-stats', {
        season,
        teamIds,
        playerIds,
        force
      });
      
      if (pitchingResult.success) {
        results.pitchingResults = pitchingResult;
        results.stepsCompleted++;
        console.log(`✅ Pitching stats completed: ${pitchingResult.statsInserted} inserted, ${pitchingResult.statsUpdated} updated`);
      } else {
        results.errors.push(`Pitching stats: ${pitchingResult.error}`);
        console.log(`❌ Pitching stats failed: ${pitchingResult.error}`);
      }
    }

    // Update job completion
    const success = results.errors.length === 0;
    const totalRecords = (results.rosterResults?.playersInserted || 0) + 
                        (results.rosterResults?.playersUpdated || 0) +
                        (results.battingResults?.statsInserted || 0) + 
                        (results.battingResults?.statsUpdated || 0) +
                        (results.pitchingResults?.statsInserted || 0) + 
                        (results.pitchingResults?.statsUpdated || 0);

    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: success ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString(),
        records_processed: totalRecords,
        errors_count: results.errors.length,
        error_details: results.errors.length > 0 ? { errors: results.errors } : null
      })
      .eq('id', jobId);

    console.log('=== COMPREHENSIVE PLAYER STATS BACKFILL COMPLETED ===');
    console.log('Final Results:', results);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      ...results,
      message: `Completed ${results.stepsCompleted}/${results.totalSteps} steps for ${season} season`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Comprehensive player stats backfill failed:', error);
    
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