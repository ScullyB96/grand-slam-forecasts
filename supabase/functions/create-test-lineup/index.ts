import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== CREATE TEST LINEUP FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const gameId = 777165;
    const metsTeamId = 123; // NYM (database ID from the query above)
    const oriolesTeamId = 122; // BAL (database ID from the query above)
    
    console.log(`Creating test lineup for game ${gameId}`);
    console.log(`Mets team ID: ${metsTeamId}, Orioles team ID: ${oriolesTeamId}`);
    
    // First, clear any existing lineups for this game
    console.log('Clearing existing lineups...');
    const { error: deleteError } = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', gameId);
    
    if (deleteError) {
      console.error('Error clearing existing lineups:', deleteError);
      throw new Error(`Failed to clear existing lineups: ${deleteError.message}`);
    }
    
    console.log('✅ Cleared existing lineups');

    // Create the test lineup data
    const lineups: any[] = [];
    
    // Mets lineup (away team)
    const metsLineup = [
      { name: 'B. Nimmo', position: 'LF', handedness: 'L' },
      { name: 'F. Lindor', position: 'SS', handedness: 'S' },
      { name: 'Juan Soto', position: 'RF', handedness: 'L' },
      { name: 'Pete Alonso', position: '1B', handedness: 'R' },
      { name: 'Jesse Winker', position: 'DH', handedness: 'L' },
      { name: 'Jeff McNeil', position: 'CF', handedness: 'L' },
      { name: 'R. Mauricio', position: '3B', handedness: 'S' },
      { name: 'Luis Torrens', position: 'C', handedness: 'R' },
      { name: 'Brett Baty', position: '2B', handedness: 'L' }
    ];
    
    // Orioles lineup (home team)
    const oriolesLineup = [
      { name: 'J. Holliday', position: '2B', handedness: 'L' },
      { name: 'J. Westburg', position: '3B', handedness: 'R' },
      { name: 'G. Henderson', position: 'SS', handedness: 'L' },
      { name: 'Ryan Mountcastle', position: '1B', handedness: 'R' },
      { name: 'R. Laureano', position: 'RF', handedness: 'R' },
      { name: 'C. Cowser', position: 'LF', handedness: 'L' },
      { name: "T. O'Neill", position: 'DH', handedness: 'R' },
      { name: 'C. Mullins', position: 'CF', handedness: 'L' },
      { name: 'J. Stallings', position: 'C', handedness: 'R' }
    ];
    
    // Add Mets batting lineup
    metsLineup.forEach((player, index) => {
      lineups.push({
        game_id: gameId,
        team_id: metsTeamId,
        lineup_type: 'batting',
        batting_order: index + 1,
        player_id: 600000 + index,
        player_name: player.name,
        position: player.position,
        handedness: player.handedness,
        is_starter: true
      });
    });
    
    // Add Orioles batting lineup
    oriolesLineup.forEach((player, index) => {
      lineups.push({
        game_id: gameId,
        team_id: oriolesTeamId,
        lineup_type: 'batting',
        batting_order: index + 1,
        player_id: 600100 + index,
        player_name: player.name,
        position: player.position,
        handedness: player.handedness,
        is_starter: true
      });
    });
    
    // Add probable pitchers
    lineups.push({
      game_id: gameId,
      team_id: metsTeamId,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 600200,
      player_name: 'David Peterson',
      position: 'SP',
      handedness: 'L',
      is_starter: true
    });
    
    lineups.push({
      game_id: gameId,
      team_id: oriolesTeamId,
      lineup_type: 'pitching',
      batting_order: null,
      player_id: 600201,
      player_name: 'Charlie Morton',
      position: 'SP',
      handedness: 'R',
      is_starter: true
    });
    
    console.log(`Inserting ${lineups.length} lineup entries...`);
    
    // Insert the lineups
    const { error: insertError } = await supabase
      .from('game_lineups')
      .insert(lineups);

    if (insertError) {
      console.error('Error inserting lineups:', insertError);
      throw new Error(`Failed to insert lineups: ${insertError.message}`);
    }
    
    console.log('✅ Successfully inserted test lineup');

    return new Response(JSON.stringify({
      success: true,
      processed: lineups.length,
      message: `Successfully created test lineup with ${lineups.length} players`,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to create test lineup:', error);
    
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