import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP MONITOR FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Monitoring for confirmed lineup updates...');
    
    // Get today's games that currently have projected/mock lineups
    const today = new Date().toISOString().split('T')[0];
    console.log('Checking games for date:', today);

    // First, verify games exist in MLB schedule API
    console.log('Fetching MLB schedule to validate games...');
    const mlbScheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`;
    const mlbResponse = await fetch(mlbScheduleUrl);
    
    if (!mlbResponse.ok) {
      throw new Error(`MLB Schedule API error: ${mlbResponse.status} ${mlbResponse.statusText}`);
    }
    
    const mlbSchedule = await mlbResponse.json();
    const validGameIds = new Set(
      mlbSchedule.dates?.[0]?.games?.map((game: any) => game.gamePk) || []
    );
    
    console.log(`Found ${validGameIds.size} valid games in MLB schedule:`, Array.from(validGameIds));
    
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
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games in database to monitor`);

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No games found for monitoring',
        checked: 0,
        updated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter games to only those that exist in MLB schedule
    const validGames = games.filter(game => validGameIds.has(game.game_id));
    const invalidGames = games.filter(game => !validGameIds.has(game.game_id));
    
    if (invalidGames.length > 0) {
      console.log(`⚠️ Found ${invalidGames.length} games in database that don't exist in MLB schedule:`, 
        invalidGames.map(g => g.game_id));
    }
    
    console.log(`Monitoring ${validGames.length} valid games (filtered from ${games.length} total)`);

    if (validGames.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No valid MLB games found for monitoring',
        checked: 0,
        updated: 0,
        invalid_games: invalidGames.map(g => g.game_id)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get team mapping for MLB ID to database ID conversion
    console.log('Fetching team mapping...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    console.log('Available teams:', teams?.map(t => `${t.name} (MLB: ${t.team_id}, DB: ${t.id})`));
    const teamIdMapping = createTeamIdMapping(teams || []);
    console.log('Team mapping created:', Array.from(teamIdMapping.entries()));

    let gamesChecked = 0;
    let gamesUpdated = 0;
    const updateResults: string[] = [];

    // Check each valid game for official lineup availability
    for (const game of validGames) {
      try {
        console.log(`Checking game ${game.game_id} for official lineups...`);
        gamesChecked++;

        // Check if we already have official lineups for this game
        const { data: existingLineups, error: lineupError } = await supabase
          .from('game_lineups')
          .select('player_name, player_id')
          .eq('game_id', game.game_id)
          .limit(5);

        if (lineupError) {
          console.error(`Error checking existing lineups for game ${game.game_id}:`, lineupError);
          continue;
        }

        // Skip if we have no lineups at all for this game
        if (!existingLineups || existingLineups.length === 0) {
          console.log(`No existing lineups found for game ${game.game_id}, skipping monitor check`);
          continue;
        }

        // Check if current lineup appears to be mock data (looking for fake player IDs and names)
        const isMockData = existingLineups.some(lineup => 
          // Check for fake player IDs (high numbers typically used for mock data)
          lineup.player_id >= 600000 ||
          // Check for placeholder names
          lineup.player_name.includes('Player (') ||
          lineup.player_name.includes('Starting Pitcher (') ||
          lineup.player_name.includes('Mock') ||
          lineup.player_name.includes('Test')
        );

        if (!isMockData) {
          console.log(`Game ${game.game_id} already has real lineup data, skipping`);
          continue;
        }

        // Try to fetch official lineups from MLB Stats API
        console.log(`Attempting to fetch official lineups for game ${game.game_id}...`);
        const gameData = await getGameLineups(game.game_id);
        const officialLineups = extractLineupsFromGameFeed(gameData, teamIdMapping);

        if (officialLineups.length > 0) {
          console.log(`✅ Found official lineups for game ${game.game_id}! Updating...`);
          
          // Delete existing mock/projected lineups
          await supabase
            .from('game_lineups')
            .delete()
            .eq('game_id', game.game_id);

          // Insert official lineups
          const { error: insertError } = await supabase
            .from('game_lineups')
            .insert(officialLineups);

          if (insertError) {
            console.error(`Error inserting official lineups for game ${game.game_id}:`, insertError);
            updateResults.push(`Failed to update game ${game.game_id}: ${insertError.message}`);
          } else {
            gamesUpdated++;
            updateResults.push(`Updated game ${game.game_id} with ${officialLineups.length} official lineup entries`);
            console.log(`✅ Successfully updated game ${game.game_id} with official lineups`);
          }
        } else {
          console.log(`⏳ Official lineups not yet available for game ${game.game_id}`);
        }

        // Add a small delay between requests to be respectful to MLB API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error checking game ${game.game_id}:`, error);
        updateResults.push(`Error checking game ${game.game_id}: ${error.message}`);
      }
    }

    console.log(`Lineup monitoring completed: ${gamesChecked} games checked, ${gamesUpdated} games updated`);

    return new Response(JSON.stringify({
      success: true,
      message: `Lineup monitoring completed`,
      checked: gamesChecked,
      updated: gamesUpdated,
      total_games: validGames.length,
      invalid_games_found: invalidGames.length,
      updates: updateResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup monitoring failed:', error);
    
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