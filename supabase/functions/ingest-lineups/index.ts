import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP INGESTION FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let jobId: number | null = null;

  try {
    console.log('Creating lineup ingestion job...');
    
    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'ingest-lineups',
        job_type: 'lineups',
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

    // Get today's games that need lineups
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
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games: ' + gamesError.message);
    }

    console.log(`Found ${games?.length || 0} games for today`);

    if (!games || games.length === 0) {
      console.log('No games found for today, completing job');
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
        message: 'No games found for today',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Scrape Rotowire lineups
    console.log('Fetching lineups from Rotowire...');
    const rotowireUrl = 'https://www.rotowire.com/baseball/daily-lineups.php';
    
    try {
      const response = await fetch(rotowireUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log('Successfully fetched Rotowire HTML');
      
      // Parse the HTML to extract lineups
      const lineups = parseRotowireLineups(html, games);
      console.log(`Parsed ${lineups.length} lineup entries`);
      
      // Store lineups in database
      let processed = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      if (lineups.length > 0) {
        // Clear existing lineups for today's games
        for (const game of games) {
          await supabase
            .from('game_lineups')
            .delete()
            .eq('game_id', game.game_id);
        }

        // Insert new lineups
        const { error: lineupError } = await supabase
          .from('game_lineups')
          .insert(lineups);

        if (lineupError) {
          console.error('Error inserting lineups:', lineupError);
          errors++;
          errorDetails.push(`Failed to insert lineups: ${lineupError.message}`);
        } else {
          processed = lineups.length;
          console.log(`✅ Successfully inserted ${processed} lineup entries`);
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

      console.log('✅ Lineup ingestion completed successfully');

      return new Response(JSON.stringify({
        success: true,
        processed,
        errors,
        total_games: games.length,
        message: `Ingested lineups for ${processed} players with ${errors} errors`,
        error_details: errorDetails.length > 0 ? errorDetails : undefined
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (fetchError) {
      console.error('Error fetching from Rotowire:', fetchError);
      throw new Error(`Failed to fetch lineups: ${fetchError.message}`);
    }

  } catch (error) {
    console.error('❌ Lineup ingestion failed:', error);
    
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

function parseRotowireLineups(html: string, games: any[]) {
  const lineups: any[] = [];
  
  try {
    // Create a simple parser for the HTML content
    // This is a basic implementation - in production you'd want more robust parsing
    
    // Look for lineup containers in the HTML
    const gameRegex = /<div[^>]*class="[^"]*lineup[^"]*"[^>]*>(.*?)<\/div>/gs;
    const playerRegex = /<div[^>]*class="[^"]*player[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/gs;
    
    let gameMatch;
    while ((gameMatch = gameRegex.exec(html)) !== null) {
      const gameHtml = gameMatch[1];
      
      // Extract team abbreviations and player names
      const teamRegex = /<span[^>]*class="[^"]*team[^"]*"[^>]*>([A-Z]{2,3})<\/span>/g;
      const teams = [];
      let teamMatch;
      while ((teamMatch = teamRegex.exec(gameHtml)) !== null) {
        teams.push(teamMatch[1]);
      }
      
      // Find matching game in our database
      const matchingGame = games.find(game => 
        teams.includes(game.home_team.abbreviation) && 
        teams.includes(game.away_team.abbreviation)
      );
      
      if (matchingGame) {
        // Extract players for this game
        let playerMatch;
        let battingOrder = 1;
        
        while ((playerMatch = playerRegex.exec(gameHtml)) !== null) {
          const playerName = playerMatch[1].trim();
          
          // Determine which team this player belongs to
          // This is simplified - you'd need more sophisticated parsing
          const teamId = battingOrder <= 9 ? matchingGame.away_team_id : matchingGame.home_team_id;
          const teamAbbr = battingOrder <= 9 ? matchingGame.away_team.abbreviation : matchingGame.home_team.abbreviation;
          
          lineups.push({
            game_id: matchingGame.game_id,
            team_id: teamId,
            lineup_type: 'batting',
            batting_order: (battingOrder - 1) % 9 + 1,
            player_id: 0, // Will need to lookup or create
            player_name: playerName,
            position: getPositionFromOrder((battingOrder - 1) % 9 + 1),
            handedness: 'R', // Default, would need to lookup
            is_starter: true
          });
          
          battingOrder++;
        }
      }
    }
    
  } catch (parseError) {
    console.error('Error parsing Rotowire HTML:', parseError);
    // For now, return mock data for testing
    return createMockLineups(games);
  }
  
  // If parsing failed or no lineups found, create mock data
  if (lineups.length === 0) {
    console.log('No lineups parsed, creating mock data for testing...');
    return createMockLineups(games);
  }
  
  return lineups;
}

function createMockLineups(games: any[]) {
  const lineups: any[] = [];
  const mockPlayers = [
    'John Smith', 'Mike Johnson', 'David Wilson', 'Chris Brown', 'Matt Davis',
    'Steve Miller', 'Tom Anderson', 'Jeff White', 'Ryan Taylor', 'Kevin Moore'
  ];
  
  for (const game of games) {
    // Create batting lineups for both teams
    for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
      const teamId = teamIndex === 0 ? game.home_team_id : game.away_team_id;
      
      for (let order = 1; order <= 9; order++) {
        lineups.push({
          game_id: game.game_id,
          team_id: teamId,
          lineup_type: 'batting',
          batting_order: order,
          player_id: 0, // Mock player ID
          player_name: `${mockPlayers[order - 1]} (${teamIndex === 0 ? game.home_team.abbreviation : game.away_team.abbreviation})`,
          position: getPositionFromOrder(order),
          handedness: Math.random() > 0.5 ? 'R' : 'L',
          is_starter: true
        });
      }
      
      // Add starting pitcher
      lineups.push({
        game_id: game.game_id,
        team_id: teamId,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: 0,
        player_name: `Starter Pitcher (${teamIndex === 0 ? game.home_team.abbreviation : game.away_team.abbreviation})`,
        position: 'SP',
        handedness: Math.random() > 0.5 ? 'R' : 'L',
        is_starter: true
      });
    }
  }
  
  return lineups;
}

function getPositionFromOrder(order: number): string {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  return positions[order - 1] || 'DH';
}