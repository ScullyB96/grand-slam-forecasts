import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GAME FEED INGESTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { gamePk, gameIds } = requestBody;

    let gamesToProcess = [];
    
    if (gamePk) {
      gamesToProcess = [gamePk];
    } else if (gameIds && gameIds.length > 0) {
      gamesToProcess = gameIds;
    } else {
      // Get recent games to process
      const { data: recentGames, error: gamesError } = await supabase
        .from('games')
        .select('game_id')
        .gte('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .in('status', ['scheduled', 'in_progress', 'final'])
        .limit(10);

      if (gamesError) {
        throw new Error('Failed to fetch games: ' + gamesError.message);
      }
      
      gamesToProcess = recentGames?.map(g => g.game_id) || [];
    }

    console.log(`Processing ${gamesToProcess.length} games`);

    let processed = 0;
    let errors = 0;
    const results = [];

    for (const gameId of gamesToProcess) {
      try {
        const result = await ingestGameFeedData(supabase, gameId);
        processed++;
        results.push(result);
        console.log(`✅ Processed game ${gameId}: ${result.pitches} pitches, ${result.hits} hits`);
      } catch (gameError) {
        console.error(`❌ Error processing game ${gameId}:`, gameError);
        errors++;
        results.push({ gameId, error: gameError.message });
      }
    }

    console.log(`✅ Game feed ingestion completed: ${processed} processed, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_games: gamesToProcess.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Game feed ingestion failed:', error);
    
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

async function ingestGameFeedData(supabase: any, gamePk: number) {
  console.log(`Fetching live feed for game ${gamePk}`);
  
  const feedUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/feed/live`;
  
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.liveData?.plays?.allPlays) {
    console.log(`No play data found for game ${gamePk}`);
    return { gameId: gamePk, pitches: 0, hits: 0 };
  }

  const allPlays = data.liveData.plays.allPlays;
  let pitchCount = 0;
  let hitCount = 0;

  const pitchBatch = [];
  const hitBatch = [];

  // Process each play
  for (const [playIndex, play] of allPlays.entries()) {
    if (!play.playEvents) continue;

    const inning = play.about?.inning || 0;
    const inningHalf = play.about?.isTopInning ? 'top' : 'bottom';
    const batterId = play.matchup?.batter?.id;
    const pitcherId = play.matchup?.pitcher?.id;

    // Process each pitch in the play
    for (const [eventIndex, event] of play.playEvents.entries()) {
      if (event.isPitch && event.pitchData) {
        const pitchData = {
          game_pk: gamePk,
          inning: inning,
          inning_half: inningHalf,
          at_bat_index: playIndex,
          pitch_number: eventIndex + 1,
          pitcher_id: pitcherId,
          batter_id: batterId,
          
          // Pitch metrics
          start_speed: parseFloat(event.pitchData.startSpeed) || null,
          end_speed: parseFloat(event.pitchData.endSpeed) || null,
          spin_rate: parseInt(event.pitchData.breaks?.spinRate) || null,
          spin_direction: parseInt(event.pitchData.breaks?.spinDirection) || null,
          break_angle: parseFloat(event.pitchData.breaks?.breakAngle) || null,
          break_length: parseFloat(event.pitchData.breaks?.breakLength) || null,
          zone: parseInt(event.pitchData.zone) || null,
          type_confidence: parseFloat(event.pitchData.typeConfidence) || null,
          plate_time: parseFloat(event.pitchData.plateTime) || null,
          extension: parseFloat(event.pitchData.extension) || null,
          
          // Coordinates
          px: parseFloat(event.pitchData.coordinates?.pX) || null,
          pz: parseFloat(event.pitchData.coordinates?.pZ) || null,
          x0: parseFloat(event.pitchData.coordinates?.x0) || null,
          y0: parseFloat(event.pitchData.coordinates?.y0) || null,
          z0: parseFloat(event.pitchData.coordinates?.z0) || null,
          vx0: parseFloat(event.pitchData.coordinates?.vX0) || null,
          vy0: parseFloat(event.pitchData.coordinates?.vY0) || null,
          vz0: parseFloat(event.pitchData.coordinates?.vZ0) || null,
          ax: parseFloat(event.pitchData.coordinates?.aX) || null,
          ay: parseFloat(event.pitchData.coordinates?.aY) || null,
          az: parseFloat(event.pitchData.coordinates?.aZ) || null,
          
          pitch_type: event.details?.type?.code || null,
          pitch_name: event.details?.type?.description || null,
          description: event.details?.description || null,
          result_type: event.details?.call?.description || null
        };

        pitchBatch.push(pitchData);
        pitchCount++;
      }

      // Process hit data if available
      if (event.hitData) {
        const hitData = {
          game_pk: gamePk,
          inning: inning,
          inning_half: inningHalf,
          at_bat_index: playIndex,
          batter_id: batterId,
          pitcher_id: pitcherId,
          
          launch_speed: parseFloat(event.hitData.launchSpeed) || null,
          launch_angle: parseFloat(event.hitData.launchAngle) || null,
          total_distance: parseFloat(event.hitData.totalDistance) || null,
          hit_distance_sc: parseFloat(event.hitData.hitDistanceSc) || null,
          
          hc_x: parseFloat(event.hitData.coordinates?.coordX) || null,
          hc_y: parseFloat(event.hitData.coordinates?.coordY) || null,
          
          trajectory: event.hitData.trajectory || null,
          hit_location: parseInt(event.hitData.location) || null
        };

        // Calculate derived metrics
        if (hitData.launch_speed && hitData.launch_angle) {
          hitData.is_barrel = (hitData.launch_speed >= 98 && hitData.launch_angle >= 26 && hitData.launch_angle <= 30);
          hitData.is_sweet_spot = (hitData.launch_angle >= 8 && hitData.launch_angle <= 32);
          hitData.is_hard_hit = (hitData.launch_speed >= 95);
        }

        hitBatch.push(hitData);
        hitCount++;
      }
    }
  }

  // Batch insert pitches
  if (pitchBatch.length > 0) {
    const { error: pitchError } = await supabase
      .from('pitch_log')
      .upsert(pitchBatch, { ignoreDuplicates: true });

    if (pitchError) {
      console.error(`Error inserting pitches for game ${gamePk}:`, pitchError);
    }
  }

  // Batch insert hits
  if (hitBatch.length > 0) {
    const { error: hitError } = await supabase
      .from('hit_log')
      .upsert(hitBatch, { ignoreDuplicates: true });

    if (hitError) {
      console.error(`Error inserting hits for game ${gamePk}:`, hitError);
    }
  }

  return { gameId: gamePk, pitches: pitchCount, hits: hitCount };
}