import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MLBTeamStatsResponse {
  stats: Array<{
    type: {
      displayName: string;
    };
    group: {
      displayName: string;
    };
    splits: Array<{
      team: {
        id: number;
        name: string;
      };
      stat: {
        wins: number;
        losses: number;
        runsScored: number;
        runsAllowed: number;
        era: string;
        avg: string;
        obp: string;
        slg: string;
      };
    }>;
  }>;
}

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

    // Fetch team standings (includes basic stats)
    const standingsUrl = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${currentSeason}&standingsTypes=regularSeason`;
    console.log(`Fetching team standings from: ${standingsUrl}`);
    
    const standingsResponse = await fetch(standingsUrl);
    if (!standingsResponse.ok) {
      throw new Error(`MLB Standings API error: ${standingsResponse.status}`);
    }
    
    const standingsData = await standingsResponse.json();
    
    // Fetch detailed team stats
    const statsUrl = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting,pitching&season=${currentSeason}`;
    console.log(`Fetching detailed team stats from: ${statsUrl}`);
    
    const statsResponse = await fetch(statsUrl);
    if (!statsResponse.ok) {
      throw new Error(`MLB Stats API error: ${statsResponse.status}`);
    }
    
    const statsData: MLBTeamStatsResponse = await statsResponse.json();
    
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process standings data first to get basic W/L records
    const teamRecords = new Map();
    standingsData.records?.forEach((division: any) => {
      division.teamRecords?.forEach((teamRecord: any) => {
        teamRecords.set(teamRecord.team.id, {
          wins: teamRecord.wins,
          losses: teamRecord.losses,
          runsScored: teamRecord.runsScored || 0,
          runsAllowed: teamRecord.runsAllowed || 0
        });
      });
    });

    console.log(`Found records for ${teamRecords.size} teams`);

    // Get internal team IDs mapping
    const { data: teams } = await supabase
      .from('teams')
      .select('id, team_id, name');

    if (!teams) {
      throw new Error('No teams found in database');
    }

    const teamIdMap = new Map(teams.map(team => [team.team_id, team.id]));

    // Process team stats from API
    for (const [mlbTeamId, record] of teamRecords) {
      try {
        const internalTeamId = teamIdMap.get(mlbTeamId);
        if (!internalTeamId) {
          console.warn(`No internal team ID found for MLB team ${mlbTeamId}`);
          continue;
        }

        // Find hitting and pitching stats for this team
        let teamAvg = 0.250;
        let teamObp = 0.320;
        let teamSlg = 0.400;
        let teamEra = 4.50;

        // Look for hitting stats
        const hittingStats = statsData.stats?.find(s => s.group.displayName === 'hitting');
        const teamHitting = hittingStats?.splits?.find(s => s.team.id === mlbTeamId);
        if (teamHitting?.stat) {
          teamAvg = parseFloat(teamHitting.stat.avg) || 0.250;
          teamObp = parseFloat(teamHitting.stat.obp) || 0.320;
          teamSlg = parseFloat(teamHitting.stat.slg) || 0.400;
        }

        // Look for pitching stats
        const pitchingStats = statsData.stats?.find(s => s.group.displayName === 'pitching');
        const teamPitching = pitchingStats?.splits?.find(s => s.team.id === mlbTeamId);
        if (teamPitching?.stat) {
          teamEra = parseFloat(teamPitching.stat.era) || 4.50;
        }

        const teamStatsData = {
          team_id: internalTeamId,
          season: currentSeason,
          wins: record.wins,
          losses: record.losses,
          runs_scored: record.runsScored,
          runs_allowed: record.runsAllowed,
          team_era: teamEra,
          team_avg: teamAvg,
          team_obp: teamObp,
          team_slg: teamSlg
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
        records_processed: teamRecords.size,
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