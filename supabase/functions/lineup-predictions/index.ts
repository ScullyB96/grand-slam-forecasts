import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineupPlayer {
  game_id: number;
  team_id: number;
  lineup_type: string;
  batting_order: number | null;
  position: string;
  player_id: number;
  player_name: string;
  handedness: string;
  is_starter: boolean;
}

interface BattingSplit {
  player_id: number;
  vs_handedness: string;
  at_bats: number;
  hits: number;
  home_runs: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  wrc_plus: number;
}

interface PitchingSplit {
  player_id: number;
  split_type: string;
  innings_pitched: number;
  hits_allowed: number;
  earned_runs: number;
  home_runs_allowed: number;
  walks: number;
  strikeouts: number;
  era: number;
  whip: number;
  k_9: number;
  bb_9: number;
}

serve(async (req) => {
  console.log('=== LINEUP-BASED PREDICTIONS FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let jobId: number | null = null;

  try {
    console.log('Creating lineup-based prediction job...');
    
    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'lineup-predictions',
        job_type: 'prediction',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create job: ' + jobError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    jobId = jobRecord.id;
    console.log('Created job with ID:', jobId);

    // Get games with lineups
    console.log('Fetching games with lineups...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        game_id,
        home_team_id,
        away_team_id,
        venue_name,
        game_date,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .limit(10);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games to predict`);

    if (!games || games.length === 0) {
      console.log('No games found, completing job');
      await supabase
        .from('data_ingestion_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: 0
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: 'No games found to predict',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each game
    for (const game of games) {
      try {
        console.log(`Processing game ${game.game_id} (${game.away_team.abbreviation} @ ${game.home_team.abbreviation})...`);
        
        // Get lineups for this game
        const { data: lineups, error: lineupsError } = await supabase
          .from('game_lineups')
          .select('*')
          .eq('game_id', game.game_id);

        if (lineupsError) {
          console.error(`Error fetching lineups for game ${game.game_id}:`, lineupsError);
          errors++;
          errorDetails.push(`Failed to fetch lineups for game ${game.game_id}: ${lineupsError.message}`);
          continue;
        }

        if (!lineups || lineups.length === 0) {
          console.log(`No lineups found for game ${game.game_id}, skipping...`);
          continue;
        }

        // Separate lineups by team and type
        const homeBatters = lineups.filter(p => p.team_id === game.home_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
        const awayBatters = lineups.filter(p => p.team_id === game.away_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
        const homePitcher = lineups.find(p => p.team_id === game.home_team_id && p.lineup_type === 'pitching' && p.is_starter);
        const awayPitcher = lineups.find(p => p.team_id === game.away_team_id && p.lineup_type === 'pitching' && p.is_starter);

        console.log(`Found ${homeBatters.length} home batters, ${awayBatters.length} away batters`);
        console.log(`Home pitcher: ${homePitcher?.player_name || 'Not found'}, Away pitcher: ${awayPitcher?.player_name || 'Not found'}`);

        // Calculate lineup-based prediction
        const prediction = await calculateLineupPrediction(
          supabase,
          game,
          homeBatters,
          awayBatters,
          homePitcher,
          awayPitcher
        );

        console.log(`Saving prediction for game ${game.game_id}:`, prediction);
        
        // Save prediction
        const { error: predError } = await supabase
          .from('game_predictions')
          .upsert(prediction, { 
            onConflict: 'game_id',
            ignoreDuplicates: false 
          });

        if (predError) {
          console.error(`Error saving prediction for game ${game.game_id}:`, predError);
          errors++;
          errorDetails.push(`Failed to save prediction for game ${game.game_id}: ${predError.message}`);
        } else {
          processed++;
          console.log(`✅ Successfully created lineup-based prediction for game ${game.game_id}`);
        }

      } catch (gameError) {
        console.error(`Error processing game ${game.game_id}:`, gameError);
        errors++;
        errorDetails.push(`Error processing game ${game.game_id}: ${gameError.message}`);
      }
    }

    // Complete job
    console.log(`Completing job: ${processed} processed, ${errors} errors`);
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: games.length,
        records_inserted: processed,
        errors_count: errors,
        error_details: errorDetails.length > 0 ? { errors: errorDetails } : null
      })
      .eq('id', jobId);

    console.log('✅ Lineup-based prediction generation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_games: games.length,
      message: `Generated ${processed} lineup-based predictions with ${errors} errors`,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup-based prediction generation failed:', error);
    
    // Update job as failed if we have a job ID
    if (jobId) {
      try {
        await supabase
          .from('data_ingestion_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { error: error.message }
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('Failed to update job as failed:', updateError);
      }
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

async function calculateLineupPrediction(
  supabase: any,
  game: any,
  homeBatters: LineupPlayer[],
  awayBatters: LineupPlayer[],
  homePitcher: LineupPlayer | undefined,
  awayPitcher: LineupPlayer | undefined
) {
  console.log('Calculating lineup-based prediction...');
  
  // Determine home/away status for pitching splits
  const isHomeGame = true; // game is at home team's venue
  const homePitcherSplit = 'home';
  const awayPitcherSplit = 'away';
  
  // Calculate expected runs for each team
  const homeExpectedRuns = await calculateTeamExpectedRuns(
    supabase,
    homeBatters,
    awayPitcher,
    2025
  );
  
  const awayExpectedRuns = await calculateTeamExpectedRuns(
    supabase,
    awayBatters,
    homePitcher,
    2025
  );

  console.log(`Expected runs - Home: ${homeExpectedRuns.toFixed(2)}, Away: ${awayExpectedRuns.toFixed(2)}`);

  // Calculate win probabilities using Pythagorean expectation with lineup adjustments
  const homeRunsAdj = Math.max(3, Math.min(12, homeExpectedRuns));
  const awayRunsAdj = Math.max(3, Math.min(12, awayExpectedRuns));
  
  // Apply home field advantage (typically 0.54 win percentage)
  const homeFieldBonus = 0.1; // 10% bonus to home team
  const adjustedHomeRuns = homeRunsAdj * (1 + homeFieldBonus);
  
  // Calculate win probabilities using runs
  const totalRuns = adjustedHomeRuns + awayRunsAdj;
  let homeWinProb = adjustedHomeRuns / totalRuns;
  let awayWinProb = awayRunsAdj / totalRuns;
  
  // Normalize probabilities
  const total = homeWinProb + awayWinProb;
  homeWinProb = homeWinProb / total;
  awayWinProb = awayWinProb / total;
  
  // Ensure probabilities are reasonable
  homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
  awayWinProb = 1 - homeWinProb;

  // Calculate confidence based on data quality
  let confidence = 0.75; // Base confidence
  
  // Increase confidence if we have full lineups
  if (homeBatters.length === 9 && awayBatters.length === 9 && homePitcher && awayPitcher) {
    confidence += 0.1;
  }
  
  // Decrease confidence if missing key data
  if (!homePitcher || !awayPitcher) {
    confidence -= 0.15;
  }

  const prediction = {
    game_id: game.game_id,
    home_win_probability: Math.round(homeWinProb * 1000) / 1000,
    away_win_probability: Math.round(awayWinProb * 1000) / 1000,
    predicted_home_score: Math.round(homeRunsAdj),
    predicted_away_score: Math.round(awayRunsAdj),
    over_under_line: 8.5,
    over_probability: 0.5,
    under_probability: 0.5,
    confidence_score: Math.round(confidence * 1000) / 1000,
    key_factors: {
      lineup_based: true,
      home_expected_runs: homeExpectedRuns,
      away_expected_runs: awayExpectedRuns,
      home_lineup_size: homeBatters.length,
      away_lineup_size: awayBatters.length,
      home_pitcher: homePitcher?.player_name || 'Unknown',
      away_pitcher: awayPitcher?.player_name || 'Unknown',
      calculation_method: 'individual_player_splits'
    },
    prediction_date: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };

  return prediction;
}

async function calculateTeamExpectedRuns(
  supabase: any,
  batters: LineupPlayer[],
  opposingPitcher: LineupPlayer | undefined,
  season: number
): Promise<number> {
  let totalExpectedRuns = 0;
  
  // Get opposing pitcher's handedness (default to R if unknown)
  const pitcherHandedness = opposingPitcher?.handedness || 'R';
  
  console.log(`Calculating expected runs for ${batters.length} batters vs ${pitcherHandedness}HP`);
  
  for (const batter of batters) {
    try {
      // Get batter's splits against this pitcher's handedness
      const { data: batterSplits, error: batterError } = await supabase
        .from('batting_splits')
        .select('*')
        .eq('player_id', batter.player_id)
        .eq('season', season)
        .eq('vs_handedness', pitcherHandedness)
        .maybeSingle();

      if (batterError && batterError.code !== 'PGRST116') {
        console.error(`Error fetching batting splits for player ${batter.player_id}:`, batterError);
        continue;
      }

      let batterOPS = 0.700; // Default OPS if no splits available
      let batterWRCPlus = 100; // Default wRC+ (league average)
      
      if (batterSplits && batterSplits.at_bats > 0) {
        batterOPS = batterSplits.ops || 0.700;
        batterWRCPlus = batterSplits.wrc_plus || 100;
        console.log(`${batter.player_name}: OPS=${batterOPS.toFixed(3)} vs ${pitcherHandedness}HP`);
      } else {
        // Fall back to overall stats if splits not available
        const { data: overallStats } = await supabase
          .from('batting_stats')
          .select('ops, wrc_plus')
          .eq('player_id', batter.player_id)
          .eq('season', season)
          .maybeSingle();
        
        if (overallStats) {
          batterOPS = overallStats.ops || 0.700;
          batterWRCPlus = overallStats.wrc_plus || 100;
        }
        console.log(`${batter.player_name}: Using overall OPS=${batterOPS.toFixed(3)} (no splits)`);
      }
      
      // Convert OPS and wRC+ to expected runs per plate appearance
      // This is a simplified model - in reality you'd use more sophisticated calculations
      const baseRunsPerPA = 0.11; // League average runs per plate appearance
      const opsAdjustment = (batterOPS - 0.700) * 0.5; // Adjust based on OPS vs league average
      const wrcAdjustment = (batterWRCPlus - 100) / 1000; // Small adjustment for wRC+
      
      const expectedRunsPerPA = Math.max(0.05, baseRunsPerPA + opsAdjustment + wrcAdjustment);
      
      // Multiply by expected plate appearances (varies by batting order)
      const plateAppearances = getExpectedPlateAppearances(batter.batting_order || 9);
      const batterExpectedRuns = expectedRunsPerPA * plateAppearances;
      
      totalExpectedRuns += batterExpectedRuns;
      console.log(`${batter.player_name} (${batter.batting_order}): ${batterExpectedRuns.toFixed(3)} expected runs`);
      
    } catch (error) {
      console.error(`Error calculating runs for batter ${batter.player_name}:`, error);
      // Add a minimal contribution if there's an error
      totalExpectedRuns += 0.4;
    }
  }
  
  // Apply pitcher adjustments if we have pitcher data
  if (opposingPitcher) {
    const pitcherAdjustment = await getPitcherAdjustment(supabase, opposingPitcher, season);
    totalExpectedRuns *= pitcherAdjustment;
    console.log(`Applied pitcher adjustment: ${pitcherAdjustment.toFixed(3)}`);
  }
  
  console.log(`Total expected runs: ${totalExpectedRuns.toFixed(2)}`);
  return totalExpectedRuns;
}

async function getPitcherAdjustment(
  supabase: any,
  pitcher: LineupPlayer,
  season: number
): Promise<number> {
  try {
    // Get pitcher's home/away splits and overall performance
    const { data: pitcherSplits } = await supabase
      .from('pitching_splits')
      .select('*')
      .eq('player_id', pitcher.player_id)
      .eq('season', season);

    const { data: overallStats } = await supabase
      .from('pitching_stats')
      .select('era, whip')
      .eq('player_id', pitcher.player_id)
      .eq('season', season)
      .maybeSingle();

    let era = 4.50; // League average ERA
    let whip = 1.30; // League average WHIP
    
    if (overallStats) {
      era = overallStats.era || 4.50;
      whip = overallStats.whip || 1.30;
    }
    
    // Better pitchers (lower ERA) should reduce runs
    // ERA of 3.00 = 0.85 multiplier, ERA of 6.00 = 1.15 multiplier
    const eraAdjustment = Math.max(0.7, Math.min(1.3, (era / 4.50)));
    const whipAdjustment = Math.max(0.8, Math.min(1.2, (whip / 1.30)));
    
    const adjustment = (eraAdjustment + whipAdjustment) / 2;
    console.log(`Pitcher ${pitcher.player_name}: ERA=${era}, WHIP=${whip}, Adjustment=${adjustment.toFixed(3)}`);
    
    return adjustment;
    
  } catch (error) {
    console.error(`Error getting pitcher adjustment for ${pitcher.player_name}:`, error);
    return 1.0; // No adjustment if error
  }
}

function getExpectedPlateAppearances(battingOrder: number): number {
  // Expected plate appearances based on batting order in a 9-inning game
  // This is a simplified model based on historical averages
  const plateAppearances = [4.5, 4.3, 4.1, 4.0, 3.8, 3.7, 3.5, 3.4, 3.2];
  return plateAppearances[battingOrder - 1] || 3.0;
}