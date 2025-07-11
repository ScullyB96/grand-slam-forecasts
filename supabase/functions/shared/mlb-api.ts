
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

// Position code mapping from MLB API numbers to position abbreviations
const positionCodeMap: { [key: string]: string } = {
  '1': 'P',   // Pitcher
  '2': 'C',   // Catcher
  '3': '1B',  // First Base
  '4': '2B',  // Second Base
  '5': '3B',  // Third Base
  '6': 'SS',  // Shortstop
  '7': 'LF',  // Left Field
  '8': 'CF',  // Center Field
  '9': 'RF',  // Right Field
  '10': 'DH', // Designated Hitter
  '11': 'PH', // Pinch Hitter
  '12': 'PR'  // Pinch Runner
};

function mapPositionCode(positionCode: string | number): string {
  const code = String(positionCode);
  return positionCodeMap[code] || code;
}

// Enhanced handedness extraction with detailed debugging
function extractBattingHandedness(player: any, playerName: string): string {
  console.log(`🔍 DEBUG - Extracting batting handedness for ${playerName}:`);
  console.log(`  Raw player object:`, JSON.stringify(player, null, 2));
  
  // Check all possible locations for batting handedness
  const sources = [
    { name: 'person.batSide.code', value: player.person?.batSide?.code },
    { name: 'person.batSide.description', value: player.person?.batSide?.description },
    { name: 'person.batSide', value: player.person?.batSide },
    { name: 'batSide.code', value: player.batSide?.code },
    { name: 'batSide.description', value: player.batSide?.description },
    { name: 'batSide', value: player.batSide },
    { name: 'batting_hand', value: player.batting_hand },
    { name: 'battingHand', value: player.battingHand }
  ];
  
  sources.forEach(source => {
    if (source.value !== undefined && source.value !== null) {
      console.log(`  - ${source.name}: ${JSON.stringify(source.value)}`);
    }
  });
  
  // Try to extract from the most reliable sources first
  if (player.person?.batSide?.code) {
    console.log(`  ✅ Using person.batSide.code: ${player.person.batSide.code}`);
    return player.person.batSide.code;
  }
  
  if (player.person?.batSide?.description) {
    const desc = player.person.batSide.description.toLowerCase();
    console.log(`  ✅ Using person.batSide.description: ${desc}`);
    if (desc.includes('left')) return 'L';
    if (desc.includes('right')) return 'R';
    if (desc.includes('switch')) return 'S';
  }
  
  // Try alternative sources
  if (player.batSide?.code) {
    console.log(`  ✅ Using batSide.code: ${player.batSide.code}`);
    return player.batSide.code;
  }
  
  if (player.batSide?.description) {
    const desc = player.batSide.description.toLowerCase();
    console.log(`  ✅ Using batSide.description: ${desc}`);
    if (desc.includes('left')) return 'L';
    if (desc.includes('right')) return 'R';
    if (desc.includes('switch')) return 'S';
  }
  
  console.log(`  ❌ No batting handedness found for ${playerName}, returning 'R' as default`);
  return 'R'; // Default to right-handed instead of 'U'
}

function extractPitchingHandedness(player: any, playerName: string): string {
  console.log(`🔍 DEBUG - Extracting pitching handedness for ${playerName}:`);
  console.log(`  Raw player object:`, JSON.stringify(player, null, 2));
  
  // Check all possible locations for pitching handedness
  const sources = [
    { name: 'person.pitchHand.code', value: player.person?.pitchHand?.code },
    { name: 'person.pitchHand.description', value: player.person?.pitchHand?.description },
    { name: 'person.pitchHand', value: player.person?.pitchHand },
    { name: 'pitchHand.code', value: player.pitchHand?.code },
    { name: 'pitchHand.description', value: player.pitchHand?.description },
    { name: 'pitchHand', value: player.pitchHand },
    { name: 'pitching_hand', value: player.pitching_hand },
    { name: 'pitchingHand', value: player.pitchingHand }
  ];
  
  sources.forEach(source => {
    if (source.value !== undefined && source.value !== null) {
      console.log(`  - ${source.name}: ${JSON.stringify(source.value)}`);
    }
  });
  
  // Try to extract from the most reliable sources first
  if (player.person?.pitchHand?.code) {
    console.log(`  ✅ Using person.pitchHand.code: ${player.person.pitchHand.code}`);
    return player.person.pitchHand.code;
  }
  
  if (player.person?.pitchHand?.description) {
    const desc = player.person.pitchHand.description.toLowerCase();
    console.log(`  ✅ Using person.pitchHand.description: ${desc}`);
    if (desc.includes('left')) return 'L';
    if (desc.includes('right')) return 'R';
  }
  
  // Try alternative sources
  if (player.pitchHand?.code) {
    console.log(`  ✅ Using pitchHand.code: ${player.pitchHand.code}`);
    return player.pitchHand.code;
  }
  
  if (player.pitchHand?.description) {
    const desc = player.pitchHand.description.toLowerCase();
    console.log(`  ✅ Using pitchHand.description: ${desc}`);
    if (desc.includes('left')) return 'L';
    if (desc.includes('right')) return 'R';
  }
  
  console.log(`  ❌ No pitching handedness found for ${playerName}, returning 'R' as default`);
  return 'R'; // Default to right-handed instead of 'U'
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

    // Try multiple sources for batting lineup data
    let battingLineupSource = null;
    let battingPlayers = [];

    // Option 1: Check batters array
    if (teamData.batters && Array.isArray(teamData.batters) && teamData.batters.length > 0) {
      console.log(`  Found batters array with ${teamData.batters.length} players`);
      battingLineupSource = 'batters';
      
      // Get detailed player info from players object
      if (teamData.players) {
        teamData.batters.forEach((playerId: number, index: number) => {
          const playerKey = `ID${playerId}`;
          const playerInfo = teamData.players[playerKey];
          
          if (playerInfo?.person) {
            battingPlayers.push({
              person: playerInfo.person,
              position: playerInfo.position,
              battingOrder: index + 1,
              stats: playerInfo.stats,
              // Include the full player info for handedness extraction
              ...playerInfo
            });
          } else {
            console.log(`    No detailed info for batter ${playerId}`);
          }
        });
      }
    }

    // Option 2: Check lineup array (fallback)
    if (battingPlayers.length === 0 && teamData.lineup && Array.isArray(teamData.lineup)) {
      console.log(`  Found lineup array with ${teamData.lineup.length} players`);
      battingLineupSource = 'lineup';
      battingPlayers = teamData.lineup;
    }

    // Option 3: Check battingOrder array (fallback)
    if (battingPlayers.length === 0 && teamData.battingOrder && Array.isArray(teamData.battingOrder)) {
      console.log(`  Found battingOrder array with ${teamData.battingOrder.length} players`);
      battingLineupSource = 'battingOrder';
      battingPlayers = teamData.battingOrder;
    }

    console.log(`  Using ${battingLineupSource} source for batting lineup (${battingPlayers.length} players)`);

    // Process batting lineup
    battingPlayers.forEach((player: any, index: number) => {
      if (!player.person) {
        console.log(`    No person data found for batting lineup entry ${index}`);
        return;
      }

      const battingOrder = player.battingOrder || (index + 1);
      
      // Only include players in the batting lineup (battingOrder 1-9)
      if (battingOrder <= 9) {
        // Extract and map position from the correct field
        let position = 'UNK';
        if (player.position?.code) {
          position = mapPositionCode(player.position.code);
        } else if (player.position?.abbreviation) {
          position = player.position.abbreviation;
        } else if (player.position?.name) {
          position = player.position.name;
        }
        
        // Extract batting handedness with enhanced debugging - pass the full player object
        const battingHand = extractBattingHandedness(player, player.person.fullName);
        
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

    // Process pitching lineup from pitchers array
    if (teamData.pitchers && Array.isArray(teamData.pitchers)) {
      console.log(`  Processing ${teamData.pitchers.length} pitchers for ${teamType} team`);
      
      teamData.pitchers.forEach((playerId: number, index: number) => {
        const playerKey = `ID${playerId}`;
        const playerInfo = teamData.players?.[playerKey];
        
        if (!playerInfo?.person) {
          console.log(`    No person data found for pitcher ${playerId}`);
          return;
        }

        const isStarter = index === 0; // First pitcher is the starter
        
        // Extract pitching handedness with enhanced debugging - pass the full playerInfo object
        const pitchingHand = extractPitchingHandedness(playerInfo, playerInfo.person.fullName);
        
        lineups.push({
          game_id: gameId,
          team_id: dbTeamId,
          lineup_type: 'pitching',
          batting_order: null,
          player_id: playerInfo.person.id,
          player_name: playerInfo.person.fullName || `Player ${playerInfo.person.id}`,
          position: isStarter ? 'SP' : 'RP',
          handedness: pitchingHand,
          is_starter: isStarter
        });
        
        console.log(`    Added pitcher: ${playerInfo.person.fullName} (${isStarter ? 'SP' : 'RP'}) - ${pitchingHand}HP`);
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
