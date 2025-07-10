import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTeamStats, extractTeamStatsFromAPI } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== TEAM STATS INGESTION FUNCTION CALLED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const currentSeason = new Date().getFullYear();
    console.log(`Starting team stats ingestion for ${currentSeason} season`);

    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'Team Statistics Ingestion',
        job_type: 'team_stats',
        data_source: 'MLB Stats API',
        status: 'running',
        started_at: new Date().toISOString(),
        season: currentSeason
      })
      .select('id')
      .single();

    if (jobError) throw jobError;
    const jobId = jobRecord.id;

    // Fetch comprehensive team stats using centralized API
    console.log('Fetching team stats from MLB API...');
    const { hitting, pitching, standings } = await getTeamStats(currentSeason);
    
    // Extract team statistics using centralized logic
    const teamStats = extractTeamStatsFromAPI(hitting, pitching, standings);
    
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`Found stats for ${teamStats.size} teams`);

    // Get internal team IDs mapping
    const { data: teams } = await supabase
      .from('teams')
      .select('id, team_id, name');

    if (!teams) {
      throw new Error('No teams found in database');
    }

    const teamIdMap = new Map(teams.map(team => [team.team_id, team.id]));

    // Process team stats from API
    for (const [mlbTeamId, record] of teamStats) {
      try {
        const internalTeamId = teamIdMap.get(mlbTeamId);
        if (!internalTeamId) {
          console.warn(`No internal team ID found for MLB team ${mlbTeamId}`);
          continue;
        }

        const teamStatsData = {
          team_id: internalTeamId,
          season: currentSeason,
          wins: record.wins || 0,
          losses: record.losses || 0,
          runs_scored: record.runsScored || 0,
          runs_allowed: record.runsAllowed || 0,
          team_era: record.team_era || 4.50,
          team_avg: record.team_avg || 0.250,
          team_obp: record.team_obp || 0.320,
          team_slg: record.team_slg || 0.400
        };

        console.log(`Upserting stats for team ${mlbTeamId}:`, teamStatsData);

        const { error } = await supabase
          .from('team_stats')
          .upsert(teamStatsData, {
            onConflict: 'team_id,season',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Error upserting team stats for ${mlbTeamId}:`, error);
          errors.push(`Team ${mlbTeamId}: ${error.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`Successfully processed team ${mlbTeamId} stats`);
        }

      } catch (error) {
        console.error(`Error processing team ${mlbTeamId}:`, error);
        errors.push(`Team ${mlbTeamId}: ${error.message}`);
        errorCount++;
      }
    }

    // Update job completion
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        records_processed: teamStats.size,
        records_inserted: processedCount,
        errors_count: errorCount,
        error_details: errors.length > 0 ? { errors } : null
      })
      .eq('id', jobId);

    console.log(`Team stats ingestion complete: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      season: currentSeason,
      teamsProcessed: processedCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Team stats ingestion failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});