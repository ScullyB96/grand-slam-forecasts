import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1';

// Rate limiting
const RATE_LIMIT_DELAY = 200;
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

async function getPlayerBattingStats(playerId: number, season: number) {
  return await makeMLBRequest(`/people/${playerId}/stats`, {
    stats: 'season',
    group: 'hitting',
    season
  });
}

function calculateAdvancedStats(stats: any) {
  const ab = stats.atBats || 0;
  const hits = stats.hits || 0;
  const singles = hits - (stats.doubles || 0) - (stats.triples || 0) - (stats.homeRuns || 0);
  
  const avg = ab > 0 ? hits / ab : 0;
  const obp = (stats.plateAppearances || 0) > 0 ? 
    ((hits + (stats.baseOnBalls || 0) + (stats.hitByPitch || 0)) / 
     ((stats.plateAppearances || 0))) : 0;
  
  const totalBases = singles + (stats.doubles || 0) * 2 + (stats.triples || 0) * 3 + (stats.homeRuns || 0) * 4;
  const slg = ab > 0 ? totalBases / ab : 0;
  const ops = obp + slg;
  const iso = slg - avg;
  
  // Simple BABIP calculation
  const babip = (ab - stats.strikeOuts - (stats.homeRuns || 0) + (stats.sacrificeFlies || 0)) > 0 ?
    (hits - (stats.homeRuns || 0)) / (ab - stats.strikeOuts - (stats.homeRuns || 0) + (stats.sacrificeFlies || 0)) : 0;

  return {
    avg: Math.round(avg * 1000) / 1000,
    obp: Math.round(obp * 1000) / 1000,
    slg: Math.round(slg * 1000) / 1000,
    ops: Math.round(ops * 1000) / 1000,
    iso: Math.round(iso * 1000) / 1000,
    babip: Math.round(babip * 1000) / 1000
  };
}

serve(async (req) => {
  console.log('=== PLAYER BATTING STATS INGESTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json();
    const { season = new Date().getFullYear(), teamIds = null, playerIds = null, force = false } = requestBody;

    console.log('Batting stats ingestion request:', { season, teamIds, playerIds, force });

    // Create ingestion job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-player-batting-stats',
        job_type: 'batting_stats',
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
    console.log('Created batting stats ingestion job with ID:', jobId);

    // Get players to process
    let playersQuery = supabase
      .from('players')
      .select(`
        *,
        team:teams(id, name, abbreviation, team_id)
      `)
      .eq('active', true);

    if (playerIds) {
      playersQuery = playersQuery.in('player_id', playerIds);
    } else if (teamIds) {
      // Get team database IDs from MLB team IDs
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .in('team_id', teamIds);
      
      if (teams && teams.length > 0) {
        playersQuery = playersQuery.in('team_id', teams.map(t => t.id));
      }
    }

    const { data: players, error: playersError } = await playersQuery;
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
      throw playersError;
    }

    console.log(`Processing batting stats for ${players.length} players`);

    const results = {
      playersProcessed: 0,
      statsInserted: 0,
      statsUpdated: 0,
      errors: [] as string[]
    };

    // Process each player
    for (const player of players) {
      try {
        console.log(`\n=== Processing batting stats for ${player.full_name} (${player.player_id}) ===`);
        
        const statsData = await getPlayerBattingStats(player.player_id, season);
        
        if (!statsData?.stats?.[0]?.splits) {
          console.log(`No batting stats found for ${player.full_name}`);
          continue;
        }

        const seasonStats = statsData.stats[0].splits.find((split: any) => 
          split.season === season.toString()
        );

        if (!seasonStats?.stat) {
          console.log(`No ${season} season stats for ${player.full_name}`);
          continue;
        }

        const stats = seasonStats.stat;
        const advancedStats = calculateAdvancedStats(stats);
        
        const battingStatsData = {
          player_id: player.player_id,
          season,
          team_id: player.team_id,
          games_played: stats.gamesPlayed || 0,
          at_bats: stats.atBats || 0,
          runs: stats.runs || 0,
          hits: stats.hits || 0,
          doubles: stats.doubles || 0,
          triples: stats.triples || 0,
          home_runs: stats.homeRuns || 0,
          rbi: stats.rbi || 0,
          walks: stats.baseOnBalls || 0,
          strikeouts: stats.strikeOuts || 0,
          stolen_bases: stats.stolenBases || 0,
          caught_stealing: stats.caughtStealing || 0,
          hit_by_pitch: stats.hitByPitch || 0,
          sacrifice_hits: stats.sacBunts || 0,
          sacrifice_flies: stats.sacrificeFlies || 0,
          avg: advancedStats.avg,
          obp: advancedStats.obp,
          slg: advancedStats.slg,
          ops: advancedStats.ops,
          iso: advancedStats.iso,
          babip: advancedStats.babip,
          wrc_plus: 100 // Default value, would need more complex calculation
        };

        // Check if stats already exist
        const { data: existingStats } = await supabase
          .from('batting_stats')
          .select('id')
          .eq('player_id', player.player_id)
          .eq('season', season)
          .maybeSingle();

        if (existingStats && !force) {
          console.log(`✅ Batting stats already exist for ${player.full_name} (${season})`);
          continue;
        }

        if (existingStats) {
          // Update existing stats
          const { error: updateError } = await supabase
            .from('batting_stats')
            .update(battingStatsData)
            .eq('player_id', player.player_id)
            .eq('season', season);

          if (updateError) {
            console.error(`Error updating batting stats for ${player.full_name}:`, updateError);
            results.errors.push(`Update ${player.full_name}: ${updateError.message}`);
          } else {
            results.statsUpdated++;
            console.log(`✅ Updated batting stats for ${player.full_name}`);
          }
        } else {
          // Insert new stats
          const { error: insertError } = await supabase
            .from('batting_stats')
            .insert(battingStatsData);

          if (insertError) {
            console.error(`Error inserting batting stats for ${player.full_name}:`, insertError);
            results.errors.push(`Insert ${player.full_name}: ${insertError.message}`);
          } else {
            results.statsInserted++;
            console.log(`✅ Inserted batting stats for ${player.full_name}`);
          }
        }

        results.playersProcessed++;

      } catch (error) {
        console.error(`Error processing batting stats for ${player.full_name}:`, error);
        results.errors.push(`${player.full_name}: ${error.message}`);
      }

      // Add small delay between players to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update job completion
    const success = results.errors.length === 0;
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: success ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString(),
        records_processed: results.playersProcessed,
        records_inserted: results.statsInserted,
        records_updated: results.statsUpdated,
        errors_count: results.errors.length,
        error_details: results.errors.length > 0 ? { errors: results.errors } : null
      })
      .eq('id', jobId);

    console.log('=== BATTING STATS INGESTION COMPLETED ===');
    console.log('Results:', results);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      ...results,
      message: `Processed ${results.playersProcessed} players, inserted ${results.statsInserted} stats, updated ${results.statsUpdated} stats`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Batting stats ingestion failed:', error);
    
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