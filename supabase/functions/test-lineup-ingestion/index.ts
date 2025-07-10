import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP INGESTION TEST FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Test with a specific game that should have lineups
    const testGameId = 777165; // Mets vs Orioles
    console.log(`Testing lineup ingestion for game ${testGameId}`);

    // Get team mapping first
    console.log('Fetching team mapping...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    console.log('Available teams in database:');
    teams?.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation}) - MLB ID: ${team.team_id}, DB ID: ${team.id}`);
    });

    const teamIdMapping = createTeamIdMapping(teams || []);
    console.log('Team ID mapping:', Array.from(teamIdMapping.entries()));

    // Try to fetch lineup from MLB API
    console.log(`Fetching game data from MLB API for game ${testGameId}...`);
    const gameData = await getGameLineups(testGameId);
    
    if (!gameData?.gameData?.teams) {
      console.log('No game data available from MLB API');
      return new Response(JSON.stringify({
        success: false,
        error: 'No game data available from MLB API',
        gameData: gameData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Game teams from MLB API:');
    console.log(`  Home: ${gameData.gameData.teams.home.name} (ID: ${gameData.gameData.teams.home.id})`);
    console.log(`  Away: ${gameData.gameData.teams.away.name} (ID: ${gameData.gameData.teams.away.id})`);

    // Extract lineups
    const lineups = extractLineupsFromGameFeed(gameData, teamIdMapping);
    console.log(`Extracted ${lineups.length} lineup entries`);

    if (lineups.length === 0) {
      console.log('No lineups extracted from game feed');
      console.log('Raw boxscore data available:', !!gameData?.liveData?.boxscore);
      console.log('Teams in boxscore:', Object.keys(gameData?.liveData?.boxscore?.teams || {}));
      
      return new Response(JSON.stringify({
        success: false,
        message: 'No lineups available in game feed',
        hasBoxscore: !!gameData?.liveData?.boxscore,
        teamsInBoxscore: Object.keys(gameData?.liveData?.boxscore?.teams || {}),
        gameData: gameData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate lineup data
    console.log('Validating lineup data...');
    const validLineups = [];
    const invalidLineups = [];
    const availableTeamIds = teams?.map(t => t.id) || [];

    lineups.forEach(lineup => {
      console.log(`Checking lineup entry: ${lineup.player_name} (Team ID: ${lineup.team_id})`);
      if (availableTeamIds.includes(lineup.team_id)) {
        validLineups.push(lineup);
      } else {
        invalidLineups.push(lineup);
        console.error(`❌ Invalid team ID ${lineup.team_id} for ${lineup.player_name}`);
      }
    });

    console.log(`Valid lineups: ${validLineups.length}, Invalid: ${invalidLineups.length}`);

    // Clear existing lineups for this game
    console.log(`Clearing existing lineups for game ${testGameId}...`);
    const { error: deleteError } = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', testGameId);

    if (deleteError) {
      console.error('Error clearing existing lineups:', deleteError);
    }

    // Insert valid lineups
    if (validLineups.length > 0) {
      console.log(`Inserting ${validLineups.length} valid lineup entries...`);
      const { error: insertError } = await supabase
        .from('game_lineups')
        .insert(validLineups);

      if (insertError) {
        console.error('Error inserting lineups:', insertError);
        throw new Error('Failed to insert lineups: ' + insertError.message);
      }

      console.log('✅ Successfully inserted lineups');
    }

    return new Response(JSON.stringify({
      success: true,
      gameId: testGameId,
      totalLineups: lineups.length,
      validLineups: validLineups.length,
      invalidLineups: invalidLineups.length,
      teamMapping: Array.from(teamIdMapping.entries()),
      availableTeamIds,
      sampleLineup: validLineups[0] || null,
      invalidEntries: invalidLineups
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});