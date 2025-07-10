import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SIMPLIFIED LINEUP TEST FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Creating test lineups...');
    
    // Get today's games
    const today = new Date().toISOString().split('T')[0];
    console.log('Fetching games for date:', today);
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        game_id,
        home_team_id,
        away_team_id,
        game_time,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('game_date', today)
      .eq('status', 'scheduled');

    if (gamesError) {
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games for today`);

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No games found for today',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create test lineups for all games
    const lineups: any[] = [];
    const mockPlayers = [
      'John Smith', 'Mike Johnson', 'David Wilson', 'Chris Brown', 'Matt Davis',
      'Steve Miller', 'Tom Anderson', 'Jeff White', 'Ryan Taylor', 'Kevin Moore'
    ];
    
    console.log('Creating mock lineups for all games...');
    
    for (const game of games) {
      console.log(`Creating lineup for game ${game.game_id}: ${game.away_team.abbreviation} @ ${game.home_team.abbreviation}`);
      
      // Create batting lineups for both teams
      for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
        const teamId = teamIndex === 0 ? game.home_team_id : game.away_team_id;
        const teamAbbr = teamIndex === 0 ? game.home_team.abbreviation : game.away_team.abbreviation;
        
        console.log(`Creating lineup for team ${teamAbbr} (ID: ${teamId})`);
        
        for (let order = 1; order <= 9; order++) {
          const player = {
            game_id: game.game_id,
            team_id: teamId,
            lineup_type: 'batting',
            batting_order: order,
            player_id: 0,
            player_name: `${mockPlayers[order - 1]} (${teamAbbr})`,
            position: getPositionFromOrder(order),
            handedness: Math.random() > 0.5 ? 'R' : 'L',
            is_starter: true
          };
          lineups.push(player);
          console.log(`Added player: ${player.player_name} - ${player.position} - Order ${order}`);
        }
        
        // Add starting pitcher
        const pitcher = {
          game_id: game.game_id,
          team_id: teamId,
          lineup_type: 'pitching',
          batting_order: null,
          player_id: 0,
          player_name: `Starting Pitcher (${teamAbbr})`,
          position: 'SP',
          handedness: Math.random() > 0.5 ? 'R' : 'L',
          is_starter: true
        };
        lineups.push(pitcher);
        console.log(`Added pitcher: ${pitcher.player_name}`);
      }
    }
    
    console.log(`Total lineups created: ${lineups.length}`);
    console.log(`Expected: ${games.length * 20} (${games.length} games × 20 players per game)`);
    
    // Clear existing lineups for today's games
    console.log('Clearing existing lineups...');
    for (const game of games) {
      const { error: deleteError } = await supabase
        .from('game_lineups')
        .delete()
        .eq('game_id', game.game_id);
        
      if (deleteError) {
        console.error(`Error deleting lineups for game ${game.game_id}:`, deleteError);
      } else {
        console.log(`Cleared lineups for game ${game.game_id}`);
      }
    }

    // Insert new lineups
    console.log('Inserting new lineups...');
    const { error: lineupError } = await supabase
      .from('game_lineups')
      .insert(lineups);

    if (lineupError) {
      console.error('Error inserting lineups:', lineupError);
      throw new Error('Failed to insert lineups: ' + lineupError.message);
    }

    console.log(`✅ Successfully inserted ${lineups.length} lineup entries`);

    return new Response(JSON.stringify({
      success: true,
      processed: lineups.length,
      total_games: games.length,
      players_per_game: 20,
      message: `Successfully created ${lineups.length} lineup entries for ${games.length} games`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test lineup creation failed:', error);
    
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

function getPositionFromOrder(order: number): string {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  return positions[order - 1] || 'DH';
}