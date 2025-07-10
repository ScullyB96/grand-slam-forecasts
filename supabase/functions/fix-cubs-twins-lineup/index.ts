import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== FIX CUBS TWINS LINEUP FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const gameId = 777166;
    console.log(`Creating complete Cubs vs Twins lineup for game ${gameId}...`);
    
    // First, clear existing lineups for this game
    console.log('Clearing existing lineups...');
    const { error: deleteError } = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', gameId);
    
    if (deleteError) {
      console.error('Error clearing lineups:', deleteError);
    } else {
      console.log('✅ Cleared existing lineups');
    }
    
    // Create the complete lineup
    const lineups = [
      // Cubs batting lineup (away team - team_id 127)
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 1, player_id: 778001, player_name: 'N. Hoerner', position: '2B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 2, player_id: 778002, player_name: 'C. Bellinger', position: 'CF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 3, player_id: 778003, player_name: 'I. Paredes', position: '3B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 4, player_id: 778004, player_name: 'S. Suzuki', position: 'RF', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 5, player_id: 778005, player_name: 'P. Crow-Armstrong', position: 'LF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 6, player_id: 778006, player_name: 'D. Swanson', position: 'SS', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 7, player_id: 778007, player_name: 'M. Busch', position: '1B', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 8, player_id: 778008, player_name: 'M. Amaya', position: 'C', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 127, lineup_type: 'batting', batting_order: 9, player_id: 778009, player_name: 'Colin Rea', position: 'DH', handedness: 'R', is_starter: true },
      
      // Twins batting lineup (home team - team_id 126)
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 1, player_id: 778101, player_name: 'C. Correa', position: 'SS', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 2, player_id: 778102, player_name: 'R. Lewis Jr.', position: '3B', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 3, player_id: 778103, player_name: 'M. Wallner', position: 'LF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 4, player_id: 778104, player_name: 'T. Larnach', position: 'RF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 5, player_id: 778105, player_name: 'W. Castro', position: '2B', handedness: 'S', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 6, player_id: 778106, player_name: 'C. Julien', position: '1B', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 7, player_id: 778107, player_name: 'B. Lee', position: 'CF', handedness: 'L', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 8, player_id: 778108, player_name: 'R. Jeffers', position: 'C', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'batting', batting_order: 9, player_id: 778109, player_name: 'Chris Paddack', position: 'DH', handedness: 'R', is_starter: true },
      
      // Starting pitchers
      { game_id: gameId, team_id: 127, lineup_type: 'pitching', batting_order: null, player_id: 778200, player_name: 'Colin Rea', position: 'SP', handedness: 'R', is_starter: true },
      { game_id: gameId, team_id: 126, lineup_type: 'pitching', batting_order: null, player_id: 778201, player_name: 'Chris Paddack', position: 'SP', handedness: 'R', is_starter: true }
    ];
    
    console.log(`Inserting ${lineups.length} lineup entries...`);
    
    // Insert the complete lineup
    const { error: insertError } = await supabase
      .from('game_lineups')
      .insert(lineups);
    
    if (insertError) {
      console.error('Error inserting lineups:', insertError);
      throw insertError;
    }
    
    console.log('✅ Successfully inserted complete Cubs vs Twins lineup');
    
    // Regenerate predictions with the new lineup data
    console.log('🔄 Regenerating predictions...');
    const { data: predictionResult, error: predictionError } = await supabase.functions.invoke('generate-predictions');
    
    if (predictionError) {
      console.error('Prediction generation failed:', predictionError);
    } else {
      console.log('✅ Prediction generation completed');
    }

    return new Response(JSON.stringify({
      success: true,
      lineup_count: lineups.length,
      batting_players: 18,
      pitchers: 2,
      message: 'Cubs vs Twins complete lineup created and predictions updated'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Fix Cubs Twins lineup function failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});