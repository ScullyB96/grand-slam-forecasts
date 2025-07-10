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

async function getPlayerPitchingStats(playerId: number, season: number) {
  return await makeMLBRequest(`/people/${playerId}/stats`, {
    stats: 'season',
    group: 'pitching',
    season
  });
}

function calculateAdvancedPitchingStats(stats: any) {
  const ip = stats.inningsPitched || 0;
  const hits = stats.hits || 0;
  const walks = stats.baseOnBalls || 0;
  const strikeouts = stats.strikeOuts || 0;
  const homeRuns = stats.homeRuns || 0;
  const earnedRuns = stats.earnedRuns || 0;
  
  // Calculate rate stats (per 9 innings)
  const k9 = ip > 0 ? (strikeouts * 9) / ip : 0;
  const bb9 = ip > 0 ? (walks * 9) / ip : 0;
  const hr9 = ip > 0 ? (homeRuns * 9) / ip : 0;
  
  // WHIP
  const whip = ip > 0 ? (hits + walks) / ip : 0;
  
  // ERA
  const era = ip > 0 ? (earnedRuns * 9) / ip : 0;
  
  // Simple BABIP for pitchers
  const atBats = stats.atBats || (hits + strikeouts + (stats.battersFaced || 0) - walks - (stats.hitBatsmen || 0));
  const babip = (atBats - strikeouts - homeRuns) > 0 ? 
    (hits - homeRuns) / (atBats - strikeouts - homeRuns) : 0;
  
  // Strand rate (approximate)
  const strandRate = 0.75; // Default value - actual calculation requires more data
  
  return {
    era: Math.round(era * 100) / 100,
    whip: Math.round(whip * 100) / 100,
    k_9: Math.round(k9 * 10) / 10,
    bb_9: Math.round(bb9 * 10) / 10,
    hr_9: Math.round(hr9 * 10) / 10,
    babip: Math.round(babip * 1000) / 1000,
    strand_rate: strandRate
  };
}

serve(async (req) => {
  console.log('=== PLAYER PITCHING STATS INGESTION STARTED ===');
  
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

    console.log('Pitching stats ingestion request:', { season, teamIds, playerIds, force });

    // Create ingestion job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-player-pitching-stats',
        job_type: 'pitching_stats',
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
    console.log('Created pitching stats ingestion job with ID:', jobId);

    // Get players to process (prioritize pitchers but include all players)
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

    console.log(`Processing pitching stats for ${players.length} players`);

    const results = {
      playersProcessed: 0,
      statsInserted: 0,
      statsUpdated: 0,
      skippedNonPitchers: 0,
      errors: [] as string[]
    };

    // Process each player
    for (const player of players) {
      try {
        console.log(`\n=== Processing pitching stats for ${player.full_name} (${player.player_id}) ===`);
        
        const statsData = await getPlayerPitchingStats(player.player_id, season);
        
        if (!statsData?.stats?.[0]?.splits) {
          console.log(`No pitching stats found for ${player.full_name}`);
          results.skippedNonPitchers++;
          continue;
        }

        const seasonStats = statsData.stats[0].splits.find((split: any) => 
          split.season === season.toString()
        );

        if (!seasonStats?.stat) {
          console.log(`No ${season} pitching season stats for ${player.full_name}`);
          results.skippedNonPitchers++;
          continue;
        }

        const stats = seasonStats.stat;
        
        // Skip players with no pitching appearances
        if (!stats.games || stats.games === 0) {
          console.log(`No pitching appearances for ${player.full_name} - skipping non-pitcher`);
          results.skippedNonPitchers++;
          continue;
        }

        // Validate pitching data quality
        const inningsPitched = parseFloat(stats.inningsPitched || '0');
        if (inningsPitched === 0) {
          console.log(`No innings pitched for ${player.full_name} - skipping`);
          results.skippedNonPitchers++;
          continue;
        }

        const advancedStats = calculateAdvancedPitchingStats(stats);
        
        const pitchingStatsData = {
          player_id: player.player_id,
          season,
          team_id: player.team_id,
          games: stats.games || 0,
          games_started: stats.gamesStarted || 0,
          innings_pitched: parseFloat(stats.inningsPitched || '0'),
          hits_allowed: stats.hits || 0,
          runs_allowed: stats.runs || 0,
          earned_runs: stats.earnedRuns || 0,
          home_runs_allowed: stats.homeRuns || 0,
          walks: stats.baseOnBalls || 0,
          intentional_walks: stats.intentionalWalks || 0,
          strikeouts: stats.strikeOuts || 0,
          hit_batters: stats.hitBatsmen || 0,
          wild_pitches: stats.wildPitches || 0,
          complete_games: stats.completeGames || 0,
          shutouts: stats.shutouts || 0,
          saves: stats.saves || 0,
          save_opportunities: stats.saveOpportunities || 0,
          holds: stats.holds || 0,
          blown_saves: stats.blownSaves || 0,
          era: advancedStats.era,
          whip: advancedStats.whip,
          k_9: advancedStats.k_9,
          bb_9: advancedStats.bb_9,
          hr_9: advancedStats.hr_9,
          babip: advancedStats.babip,
          strand_rate: advancedStats.strand_rate,
          fip: 0, // Would need more complex calculation
          xfip: 0 // Would need more complex calculation
        };

        // Check if stats already exist
        const { data: existingStats } = await supabase
          .from('pitching_stats')
          .select('id')
          .eq('player_id', player.player_id)
          .eq('season', season)
          .maybeSingle();

        if (existingStats && !force) {
          console.log(`✅ Pitching stats already exist for ${player.full_name} (${season})`);
          continue;
        }

        if (existingStats) {
          // Update existing stats
          const { error: updateError } = await supabase
            .from('pitching_stats')
            .update(pitchingStatsData)
            .eq('player_id', player.player_id)
            .eq('season', season);

          if (updateError) {
            console.error(`Error updating pitching stats for ${player.full_name}:`, updateError);
            results.errors.push(`Update ${player.full_name}: ${updateError.message}`);
          } else {
            results.statsUpdated++;
            console.log(`✅ Updated pitching stats for ${player.full_name}`);
          }
        } else {
          // Insert new stats
          const { error: insertError } = await supabase
            .from('pitching_stats')
            .insert(pitchingStatsData);

          if (insertError) {
            console.error(`Error inserting pitching stats for ${player.full_name}:`, insertError);
            results.errors.push(`Insert ${player.full_name}: ${insertError.message}`);
          } else {
            results.statsInserted++;
            console.log(`✅ Inserted pitching stats for ${player.full_name}`);
          }
        }

        results.playersProcessed++;

      } catch (error) {
        console.error(`Error processing pitching stats for ${player.full_name}:`, error);
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

    console.log('=== PITCHING STATS INGESTION COMPLETED ===');
    console.log('Results:', results);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      ...results,
      message: `Processed ${results.playersProcessed} pitchers, inserted ${results.statsInserted} stats, updated ${results.statsUpdated} stats, skipped ${results.skippedNonPitchers} non-pitchers`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Pitching stats ingestion failed:', error);
    
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