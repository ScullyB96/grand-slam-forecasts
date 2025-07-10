import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== CREATE TEST LINEUP FUNCTION STARTED ===');
  console.log('Request method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Supabase client created');

    const gameId = 777165;
    const metsTeamId = 123; // NYM database ID
    const oriolesTeamId = 122; // BAL database ID
    
    console.log(`Creating test lineup for game ${gameId}`);
    console.log(`Mets team ID: ${metsTeamId}, Orioles team ID: ${oriolesTeamId}`);
    
    // First, delete any existing lineups for this game
    console.log('Deleting existing lineups...');
    const { error: deleteError } = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', gameId);
    
    if (deleteError) {
      console.error('Error deleting existing lineups:', deleteError);
      // Continue anyway - maybe no data exists
    } else {
      console.log('✅ Deleted existing lineups (if any)');
    }

    // Create the test lineup data
    const lineups = [
      // Mets batting lineup (away team)
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 1, player_id: 600001, player_name: 'B. Nimmo', position: 'LF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 2, player_id: 600002, player_name: 'F. Lindor', position: 'SS', handedness: 'S', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 3, player_id: 600003, player_name: 'Juan Soto', position: 'RF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 4, player_id: 600004, player_name: 'Pete Alonso', position: '1B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 5, player_id: 600005, player_name: 'Jesse Winker', position: 'DH', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 6, player_id: 600006, player_name: 'Jeff McNeil', position: 'CF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 7, player_id: 600007, player_name: 'R. Mauricio', position: '3B', handedness: 'S', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 8, player_id: 600008, player_name: 'Luis Torrens', position: 'C', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'batting', batting_order: 9, player_id: 600009, player_name: 'Brett Baty', position: '2B', handedness: 'L', is_starter: true },
      
      // Orioles batting lineup (home team)
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 1, player_id: 600101, player_name: 'J. Holliday', position: '2B', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 2, player_id: 600102, player_name: 'J. Westburg', position: '3B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 3, player_id: 600103, player_name: 'G. Henderson', position: 'SS', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 4, player_id: 600104, player_name: 'Ryan Mountcastle', position: '1B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 5, player_id: 600105, player_name: 'R. Laureano', position: 'RF', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 6, player_id: 600106, player_name: 'C. Cowser', position: 'LF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 7, player_id: 600107, player_name: "T. O'Neill", position: 'DH', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 8, player_id: 600108, player_name: 'C. Mullins', position: 'CF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'batting', batting_order: 9, player_id: 600109, player_name: 'J. Stallings', position: 'C', handedness: 'R', is_starter: true },
      
      // Pitchers
      { game_id: gameId, team_id: metsTeamId, lineup_type: 'pitching', batting_order: null, player_id: 600200, player_name: 'David Peterson', position: 'SP', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: oriolesTeamId, lineup_type: 'pitching', batting_order: null, player_id: 600201, player_name: 'Charlie Morton', position: 'SP', handedness: 'R', is_starter: true }
    ];
    
    console.log(`Inserting ${lineups.length} lineup entries...`);
    
    // Insert the lineups
    const { data, error: insertError } = await supabase
      .from('game_lineups')
      .insert(lineups)
      .select();

    if (insertError) {
      console.error('Error inserting lineups:', insertError);
      throw new Error(`Failed to insert lineups: ${insertError.message}`);
    }
    
    console.log('✅ Successfully inserted test lineup:', data?.length || 0, 'records');

    // Verify the data was inserted
    const { data: verifyData, error: verifyError } = await supabase
      .from('game_lineups')
      .select('*')
      .eq('game_id', gameId);
    
    if (verifyError) {
      console.error('Error verifying insertion:', verifyError);
    } else {
      console.log(`✅ Verification: Found ${verifyData?.length || 0} lineup records for game ${gameId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      processed: lineups.length,
      inserted: data?.length || 0,
      verified: verifyData?.length || 0,
      message: `Successfully created test lineup with ${data?.length || 0} players`,
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