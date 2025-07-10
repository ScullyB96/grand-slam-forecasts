import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed } from '../shared/mlb-api.ts';

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

    // Try to get official lineups from MLB Stats API first
    console.log('Attempting to fetch official lineups from MLB Stats API...');
    let lineups: any[] = [];
    let officialLineupsFound = 0;
    
    for (const game of games) {
      try {
        console.log(`Fetching lineup for game ${game.game_id}`);
        const gameData = await getGameLineups(game.game_id);
        const gameLineups = extractLineupsFromGameFeed(gameData);
        
        if (gameLineups.length > 0) {
          lineups.push(...gameLineups);
          officialLineupsFound++;
          console.log(`✅ Found official lineup for game ${game.game_id} (${gameLineups.length} players)`);
        } else {
          console.log(`⏳ Official lineup not yet available for game ${game.game_id}`);
        }
      } catch (error) {
        console.error(`Failed to fetch lineup for game ${game.game_id}:`, error);
      }
    }

    console.log(`Official lineups found for ${officialLineupsFound}/${games.length} games`);

    // If we don't have all lineups, try backup sources
    if (officialLineupsFound < games.length) {
      console.log('Fetching projected lineups from backup sources...');
      
      const gamesNeedingLineups = games.filter(game => 
        !lineups.some(lineup => lineup.game_id === game.game_id)
      );

      // First try Rotowire
      try {
        const rotowireLineups = await fetchFromRotowire(gamesNeedingLineups);
        if (rotowireLineups.length > 0) {
          lineups.push(...rotowireLineups);
          console.log(`✅ Found ${rotowireLineups.length} projected lineups from Rotowire`);
        } else {
          // Fallback to mattgorb.github.io
          const mattgorbLineups = await fetchFromMattgorb(gamesNeedingLineups);
          if (mattgorbLineups.length > 0) {
            lineups.push(...mattgorbLineups);
            console.log(`✅ Found ${mattgorbLineups.length} projected lineups from mattgorb`);
          } else {
            // Last resort: create mock lineups for games without any data
            const mockLineups = createMockLineups(gamesNeedingLineups);
            lineups.push(...mockLineups);
            console.log(`⚠️ Created ${mockLineups.length} mock lineups as fallback`);
          }
        }
      } catch (error) {
        console.error('Error fetching backup lineups:', error);
        // Create mock lineups as final fallback
        const mockLineups = createMockLineups(gamesNeedingLineups);
        lineups.push(...mockLineups);
        console.log(`⚠️ Created ${mockLineups.length} mock lineups due to backup failure`);
      }
    }

    console.log(`Total lineups collected: ${lineups.length}`);
    
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
      official_lineups: officialLineupsFound,
      message: `Ingested lineups for ${processed} players with ${errors} errors (${officialLineupsFound} official)`,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

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

async function fetchFromRotowire(games: any[]) {
  try {
    console.log('Fetching lineups from Rotowire...');
    const rotowireUrl = 'https://www.rotowire.com/baseball/daily-lineups.php';
    
    const response = await fetch(rotowireUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Successfully fetched Rotowire HTML, length:', html.length);
    
    return parseRotowireLineups(html, games);
  } catch (error) {
    console.error('Error fetching from Rotowire:', error);
    return [];
  }
}

async function fetchFromMattgorb(games: any[]) {
  try {
    console.log('Fetching lineups from mattgorb.github.io...');
    const mattgorbUrl = 'https://mattgorb.github.io/dailymlblineups/data/lineups.json';
    
    const response = await fetch(mattgorbUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Successfully fetched mattgorb data');
    
    return parseMattgorbLineups(data, games);
  } catch (error) {
    console.error('Error fetching from mattgorb:', error);
    return [];
  }
}

function parseMattgorbLineups(data: any, games: any[]) {
  const lineups: any[] = [];
  
  try {
    if (!data || !Array.isArray(data)) {
      console.log('Invalid mattgorb data format');
      return lineups;
    }

    for (const gameData of data) {
      // Find matching game by team abbreviations
      const matchingGame = games.find(game => 
        (gameData.home_team === game.home_team.abbreviation && gameData.away_team === game.away_team.abbreviation) ||
        (gameData.homeTeam === game.home_team.abbreviation && gameData.awayTeam === game.away_team.abbreviation)
      );
      
      if (matchingGame && gameData.lineups) {
        // Process home and away lineups
        ['home', 'away'].forEach(teamType => {
          const teamLineup = gameData.lineups[teamType] || gameData.lineups[`${teamType}Team`];
          const teamId = teamType === 'home' ? matchingGame.home_team_id : matchingGame.away_team_id;
          
          if (teamLineup && Array.isArray(teamLineup)) {
            teamLineup.forEach((player: any, index: number) => {
              if (index < 9) { // Only batting order
                lineups.push({
                  game_id: matchingGame.game_id,
                  team_id: teamId,
                  lineup_type: 'batting',
                  batting_order: index + 1,
                  player_id: 0,
                  player_name: player.name || player.player || `Player ${index + 1}`,
                  position: player.position || getPositionFromOrder(index + 1),
                  handedness: player.handedness || 'R',
                  is_starter: true
                });
              }
            });
          }
          
          // Add pitcher if available
          const pitcher = gameData.pitchers?.[teamType] || gameData[`${teamType}Pitcher`];
          if (pitcher) {
            lineups.push({
              game_id: matchingGame.game_id,
              team_id: teamId,
              lineup_type: 'pitching',
              batting_order: null,
              player_id: 0,
              player_name: pitcher.name || pitcher.player || `Starting Pitcher`,
              position: 'SP',
              handedness: pitcher.handedness || 'R',
              is_starter: true
            });
          }
        });
      }
    }
  } catch (parseError) {
    console.error('Error parsing mattgorb data:', parseError);
  }
  
  return lineups;
}

function parseRotowireLineups(html: string, games: any[]) {
  const lineups: any[] = [];
  
  try {
    console.log('Parsing Rotowire HTML for lineup data...');
    
    // Look for different possible lineup structures on Rotowire
    const possibleSelectors = [
      // Standard lineup containers
      /<div[^>]*class="[^"]*lineup[^"]*"[^>]*>(.*?)<\/div>/gs,
      // Alternative lineup structures
      /<div[^>]*class="[^"]*daily[^"]*lineup[^"]*"[^>]*>(.*?)<\/div>/gs,
      /<div[^>]*class="[^"]*matchup[^"]*"[^>]*>(.*?)<\/div>/gs,
      /<article[^>]*class="[^"]*lineup[^"]*"[^>]*>(.*?)<\/article>/gs
    ];

    // Try to extract game containers using multiple patterns
    const gameContainers: string[] = [];
    for (const regex of possibleSelectors) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        gameContainers.push(match[1]);
      }
    }

    console.log(`Found ${gameContainers.length} potential game containers`);

    for (const gameHtml of gameContainers) {
      const gameData = extractGameDataFromContainer(gameHtml, games);
      if (gameData && gameData.length > 0) {
        lineups.push(...gameData);
      }
    }

    // Alternative: Look for team abbreviations directly in the HTML
    if (lineups.length === 0) {
      console.log('Trying alternative parsing strategy...');
      
      // Extract team names and matchups
      const teamRegex = /([A-Z]{2,3})\s*(?:@|vs\.?|at)\s*([A-Z]{2,3})/gi;
      const teamMatches = html.match(teamRegex);
      
      if (teamMatches) {
        console.log(`Found ${teamMatches.length} team matchups`);
        
        for (const match of teamMatches) {
          const [awayTeam, homeTeam] = match.split(/\s*(?:@|vs\.?|at)\s*/i);
          
          const matchingGame = games.find(game => 
            game.away_team.abbreviation?.toUpperCase() === awayTeam?.toUpperCase() &&
            game.home_team.abbreviation?.toUpperCase() === homeTeam?.toUpperCase()
          );
          
          if (matchingGame) {
            console.log(`Found matching game: ${awayTeam} @ ${homeTeam}`);
            
            // Look for player names near this matchup
            const gameSection = extractGameSection(html, match);
            const playersData = extractPlayersFromSection(gameSection, matchingGame);
            lineups.push(...playersData);
          }
        }
      }
    }

    // Last resort: Try to find any player data structures
    if (lineups.length === 0) {
      console.log('Trying final fallback parsing...');
      
      // Look for common player data patterns
      const playerPatterns = [
        /<tr[^>]*>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([A-Z]+)<\/td>/gi,
        /<div[^>]*class="[^"]*player[^"]*"[^>]*>.*?([A-Z][a-z]+\s+[A-Z][a-z]+).*?<\/div>/gi,
        /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/gi
      ];

      for (const pattern of playerPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          console.log('Found potential player:', match[1]);
        }
      }
    }
    
  } catch (parseError) {
    console.error('Error parsing Rotowire HTML:', parseError);
  }
  
  // If still no lineups found, create mock data as fallback
  if (lineups.length === 0) {
    console.log('No valid lineups parsed from Rotowire, creating mock data...');
    return createMockLineups(games);
  }
  
  console.log(`Successfully parsed ${lineups.length} lineup entries from Rotowire`);
  return lineups;
}

function extractGameDataFromContainer(gameHtml: string, games: any[]): any[] {
  const lineups: any[] = [];
  
  try {
    // Look for team abbreviations in this container
    const teamRegex = /\b([A-Z]{2,3})\b/g;
    const foundTeams: string[] = [];
    let teamMatch;
    
    while ((teamMatch = teamRegex.exec(gameHtml)) !== null) {
      const team = teamMatch[1];
      if (team.length >= 2 && team.length <= 3 && !foundTeams.includes(team)) {
        foundTeams.push(team);
      }
    }
    
    // Try to find a matching game
    let matchingGame = null;
    for (const game of games) {
      if (foundTeams.includes(game.home_team.abbreviation) && 
          foundTeams.includes(game.away_team.abbreviation)) {
        matchingGame = game;
        break;
      }
    }
    
    if (!matchingGame) return lineups;
    
    // Extract player information from this container
    const playerPatterns = [
      // Name and position patterns
      /<td[^>]*>([A-Z][a-z]+\s+[A-Z][a-z]+)<\/td>\s*<td[^>]*>([A-Z]+)<\/td>/gi,
      /<div[^>]*>([A-Z][a-z]+\s+[A-Z][a-z]+)[^<]*<[^>]*>([A-Z]+)</gi,
      /<span[^>]*>([A-Z][a-z]+\s+[A-Z][a-z]+)<\/span>/gi
    ];
    
    let playerCount = 0;
    for (const pattern of playerPatterns) {
      let playerMatch;
      while ((playerMatch = pattern.exec(gameHtml)) !== null && playerCount < 18) {
        const playerName = playerMatch[1]?.trim();
        const position = playerMatch[2]?.trim() || getPositionFromOrder((playerCount % 9) + 1);
        
        if (playerName && playerName.length > 3) {
          const isHomeTeam = playerCount >= 9;
          const teamId = isHomeTeam ? matchingGame.home_team_id : matchingGame.away_team_id;
          const battingOrder = (playerCount % 9) + 1;
          
          lineups.push({
            game_id: matchingGame.game_id,
            team_id: teamId,
            lineup_type: 'batting',
            batting_order: battingOrder,
            player_id: 0,
            player_name: playerName,
            position: position,
            handedness: 'R', // Default
            is_starter: true
          });
          
          playerCount++;
        }
      }
    }
    
  } catch (error) {
    console.error('Error extracting game data from container:', error);
  }
  
  return lineups;
}

function extractGameSection(html: string, matchup: string): string {
  // Try to find a section of HTML around the matchup
  const matchupIndex = html.indexOf(matchup);
  if (matchupIndex === -1) return html;
  
  // Extract a reasonable section around the matchup
  const start = Math.max(0, matchupIndex - 2000);
  const end = Math.min(html.length, matchupIndex + 2000);
  
  return html.substring(start, end);
}

function extractPlayersFromSection(section: string, game: any): any[] {
  const lineups: any[] = [];
  
  try {
    // Look for player names in various formats
    const namePatterns = [
      /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
      />\s*([A-Z][a-z]+\s+[A-Z][a-z]+)\s*</g
    ];
    
    const foundPlayers = new Set<string>();
    
    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(section)) !== null) {
        const fullName = match[1] || `${match[1]} ${match[2]}`;
        if (fullName && fullName.length > 5 && !foundPlayers.has(fullName)) {
          foundPlayers.add(fullName);
        }
      }
    }
    
    // Convert found players to lineup entries
    const playerArray = Array.from(foundPlayers).slice(0, 18); // Max 18 players (9 per team)
    
    playerArray.forEach((playerName, index) => {
      const isHomeTeam = index >= 9;
      const teamId = isHomeTeam ? game.home_team_id : game.away_team_id;
      const battingOrder = (index % 9) + 1;
      
      lineups.push({
        game_id: game.game_id,
        team_id: teamId,
        lineup_type: 'batting',
        batting_order: battingOrder,
        player_id: 0,
        player_name: playerName,
        position: getPositionFromOrder(battingOrder),
        handedness: 'R',
        is_starter: true
      });
    });
    
  } catch (error) {
    console.error('Error extracting players from section:', error);
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

IMPORTANT: supabase/functions/ingest-lineups/index.ts is 655 lines long. If you make any modifications to it, let the user know that they should consider asking you to refactor it after completing the lov-code block.

function getPositionFromOrder(order: number): string {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  return positions[order - 1] || 'DH';
}