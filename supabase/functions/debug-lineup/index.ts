import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== DEBUG LINEUP FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const gameId = 777166; // Cubs vs Twins
    console.log(`Creating Cubs vs Twins test lineup for game ${gameId}...`);
    
    // Clear existing lineups for this game
    const { error: deleteError } = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', gameId);
    
    if (deleteError) {
      console.error('Error clearing lineups:', deleteError);
    }
    
    // Create Cubs vs Twins lineup directly
    const cubsTeamId = 127; // CHC
    const twinsTeamId = 126; // MIN
    
    const lineups: any[] = [];
    
    // Cubs lineup (away team)
    const cubsLineup = [
      { name: 'N. Hoerner', position: '2B', handedness: 'R' },
      { name: 'C. Bellinger', position: 'CF', handedness: 'L' },
      { name: 'I. Paredes', position: '3B', handedness: 'R' },
      { name: 'S. Suzuki', position: 'RF', handedness: 'R' },
      { name: 'P. Crow-Armstrong', position: 'LF', handedness: 'L' },
      { name: 'D. Swanson', position: 'SS', handedness: 'R' },
      { name: 'M. Busch', position: '1B', handedness: 'L' },
      { name: 'M. Amaya', position: 'C', handedness: 'R' },
      { name: 'Colin Rea', position: 'DH', handedness: 'R' }
    ];
    
    // Twins lineup (home team)
    const twinsLineup = [
      { name: 'C. Correa', position: 'SS', handedness: 'R' },
      { name: 'R. Lewis Jr.', position: '3B', handedness: 'R' },
      { name: 'M. Wallner', position: 'LF', handedness: 'L' },
      { name: 'T. Larnach', position: 'RF', handedness: 'L' },
      { name: 'W. Castro', position: '2B', handedness: 'S' },
      { name: 'C. Julien', position: '1B', handedness: 'L' },
      { name: 'B. Lee', position: 'CF', handedness: 'L' },
      { name: 'R. Jeffers', position: 'C', handedness: 'R' },
      { name: 'Chris Paddack', position: 'DH', handedness: 'R' }
    ];
    
    // Add Cubs batting lineup
    cubsLineup.forEach((player, index) => {
      lineups.push({
        game_id: gameId,
        team_id: cubsTeamId,
        lineup_type: 'batting',
        batting_order: index + 1,
        player_id: 778000 + index,
        player_name: player.name,
        position: player.position,
        handedness: player.handedness,
        is_starter: true
      });
    });
    
    // Add Twins batting lineup
    twinsLineup.forEach((player, index) => {
      lineups.push({
        game_id: gameId,
        team_id: twinsTeamId,
        lineup_type: 'batting',
        batting_order: index + 1,
        player_id: 778100 + index,
        player_name: player.name,
        position: player.position,
        handedness: player.handedness,
        is_starter: true
      });
    });
    
    // Add starting pitchers
    lineups.push({
      game_id: gameId,
      team_id: cubsTeamId,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 778200,
      player_name: 'Colin Rea',
      position: 'SP',
      handedness: 'R',
      is_starter: true
    });
    
    lineups.push({
      game_id: gameId,
      team_id: twinsTeamId,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 778201,
      player_name: 'Chris Paddack',
      position: 'SP',
      handedness: 'R',
      is_starter: true
    });
    
    console.log(`Created ${lineups.length} lineup entries for Cubs vs Twins`);
    
    // Insert the lineups
    const { error: insertError } = await supabase
      .from('game_lineups')
      .insert(lineups);
    
    if (insertError) {
      console.error('Error inserting lineups:', insertError);
      throw insertError;
    }
    
    console.log('✅ Successfully inserted Cubs vs Twins lineup');

    return new Response(JSON.stringify({
      success: true,
      lineup_count: lineups.length,
      message: 'Cubs vs Twins lineup created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Debug lineup function failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});