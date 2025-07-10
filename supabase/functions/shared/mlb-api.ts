
import "https://deno.land/x/xhr@0.1.0/mod.ts";

export async function getSchedule(date: string) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const response = await fetch(url);
  return await response.json();
}

export async function getGameLineups(gamePk: number) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const response = await fetch(url);
  return await response.json();
}

export async function getGameBoxscore(gamePk: number) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

export function createTeamIdMapping(teams: { id: number, team_id: number }[]): Map<number, number> {
  const teamIdMapping = new Map<number, number>();
  teams.forEach(team => {
    teamIdMapping.set(team.team_id, team.id);
  });
  return teamIdMapping;
}

export function extractLineupsFromBoxscore(boxscoreData: any, gameId: number, teamIdMapping: Map<number, number>): any[] {
  console.log(`🔍 Extracting lineups from boxscore for game ${gameId}`);
  
  if (!boxscoreData?.teams) {
    console.log('❌ No teams data in boxscore');
    return [];
  }

  const lineups: any[] = [];

  // Process both home and away teams
  ['home', 'away'].forEach(teamType => {
    const teamData = boxscoreData.teams[teamType];
    if (!teamData) {
      console.log(`❌ No ${teamType} team data`);
      return;
    }

    const mlbTeamId = teamData.team?.id;
    if (!mlbTeamId) {
      console.log(`❌ No team ID found for ${teamType} team`);
      return;
    }

    const dbTeamId = teamIdMapping.get(mlbTeamId);
    if (!dbTeamId) {
      console.log(`❌ No database team ID mapping found for MLB team ${mlbTeamId}`);
      return;
    }

    console.log(`📋 Processing ${teamType} team: MLB ID ${mlbTeamId} -> DB ID ${dbTeamId}`);

    // Process batting lineup from the lineup array (not batters array)
    if (teamData.lineup && Array.isArray(teamData.lineup)) {
      console.log(`  Processing ${teamData.lineup.length} lineup entries for ${teamType} team`);
      
      // Log the first lineup entry structure for debugging
      if (teamData.lineup.length > 0) {
        console.log(`📊 Sample lineup entry structure:`, JSON.stringify(teamData.lineup[0], null, 2));
      }
      
      teamData.lineup.forEach((player: any, index: number) => {
        if (!player.person) {
          console.log(`    No person data found for lineup entry ${index}`);
          return;
        }

        const battingOrder = player.battingOrder || (index + 1);
        
        // Only include players in the batting lineup (battingOrder 1-9)
        if (battingOrder <= 9) {
          // Extract position from the correct field
          const position = player.position?.code || player.position?.abbreviation || 'UNK';
          
          // Extract batting handedness
          const battingHand = player.person?.batSide?.code || 'U';
          
          lineups.push({
            game_id: gameId,
            team_id: dbTeamId,
            lineup_type: 'batting',
            batting_order: battingOrder,
            player_id: player.person.id,
            player_name: player.person.fullName || `Player ${player.person.id}`,
            position: position,
            handedness: battingHand,
            is_starter: true
          });
          
          console.log(`    Added batter: ${player.person.fullName} (#${battingOrder}) - ${position} - ${battingHand}`);
        }
      });
    } else {
      console.log(`  No lineup array found for ${teamType} team`);
    }

    // Process pitching lineup from pitchers array
    if (teamData.pitchers && Array.isArray(teamData.pitchers)) {
      console.log(`  Processing ${teamData.pitchers.length} pitchers for ${teamType} team`);
      
      teamData.pitchers.forEach((pitcher: any, index: number) => {
        if (!pitcher.person) {
          console.log(`    No person data found for pitcher ${index}`);
          return;
        }

        const isStarter = index === 0; // First pitcher is the starter
        
        // Extract pitching handedness
        const pitchingHand = pitcher.person?.pitchHand?.code || 'U';
        
        lineups.push({
          game_id: gameId,
          team_id: dbTeamId,
          lineup_type: 'pitching',
          batting_order: null,
          player_id: pitcher.person.id,
          player_name: pitcher.person.fullName || `Player ${pitcher.person.id}`,
          position: isStarter ? 'SP' : 'RP',
          handedness: pitchingHand,
          is_starter: isStarter
        });
        
        console.log(`    Added pitcher: ${pitcher.person.fullName} (${isStarter ? 'SP' : 'RP'}) - ${pitchingHand}HP`);
      });
    } else {
      console.log(`  No pitchers array found for ${teamType} team`);
    }
  });

  console.log(`✅ Extracted ${lineups.length} total lineup entries for game ${gameId}`);
  
  // Validate lineup counts
  const battingLineups = lineups.filter(l => l.lineup_type === 'batting');
  const pitchingLineups = lineups.filter(l => l.lineup_type === 'pitching');
  const starters = pitchingLineups.filter(p => p.is_starter);
  
  console.log(`📊 Lineup validation for game ${gameId}:`);
  console.log(`  - Total batting entries: ${battingLineups.length} (expected: 18 for both teams)`);
  console.log(`  - Total pitching entries: ${pitchingLineups.length}`);
  console.log(`  - Starting pitchers: ${starters.length} (expected: 2)`);
  
  // Group by team for detailed validation
  const homeTeamLineups = lineups.filter(l => l.team_id === teamIdMapping.get(boxscoreData.teams.home?.team?.id));
  const awayTeamLineups = lineups.filter(l => l.team_id === teamIdMapping.get(boxscoreData.teams.away?.team?.id));
  
  console.log(`  - Home team entries: ${homeTeamLineups.length} (batting: ${homeTeamLineups.filter(l => l.lineup_type === 'batting').length})`);
  console.log(`  - Away team entries: ${awayTeamLineups.length} (batting: ${awayTeamLineups.filter(l => l.lineup_type === 'batting').length})`);
  
  return lineups;
}

// Legacy function for backward compatibility
export function extractLineupsFromGameFeed(gameData: any, teamIdMapping: Map<number, number>): any[] {
  if (!gameData?.liveData?.boxscore) {
    console.log('No boxscore data available in game feed');
    return [];
  }
  
  return extractLineupsFromBoxscore(gameData.liveData.boxscore, gameData.gameData.game.pk, teamIdMapping);
}
