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
  console.log(`🔍 Raw boxscore data structure for game ${gamePk}:`, JSON.stringify(data, null, 2));
  return data;
}

export function extractLineupsFromGameFeed(gameData: any, teamIdMapping: Map<number, number>): any[] {
  if (!gameData?.liveData?.boxscore?.teams) {
    console.log('No boxscore data available');
    return [];
  }

  const lineups: any[] = [];

  // Process both home and away teams
  ['home', 'away'].forEach(teamType => {
    const teamData = gameData.liveData.boxscore.teams[teamType];
    if (!teamData) {
      console.log(`No ${teamType} team data`);
      return;
    }

    const mlbTeamId = teamData.team.id;
    const dbTeamId = teamIdMapping.get(mlbTeamId);
    if (!dbTeamId) {
      console.log(`No database team ID mapping found for MLB team ${mlbTeamId}`);
      return;
    }

    // Process batting lineup
    if (teamData.batters && Array.isArray(teamData.batters)) {
      teamData.batters.forEach((playerId: number, index: number) => {
        const playerData = teamData.players[`ID${playerId}`]?.person;
        if (playerData) {
          const battingOrder = index + 1;
          lineups.push({
            game_id: gameData.gameData.game.pk,
            team_id: dbTeamId,
            lineup_type: 'batting',
            batting_order: battingOrder,
            player_id: playerId,
            player_name: playerData.fullName || `Player ${playerId}`,
            position: teamData.battingOrder[playerId]?.position?.abbreviation || 'DH',
            handedness: playerData.batSide?.code || 'R',
            is_starter: true
          });
        }
      });
    }

    // Process pitching lineup
    if (teamData.pitchers && Array.isArray(teamData.pitchers)) {
      teamData.pitchers.forEach((playerId: number) => {
        const playerData = teamData.players[`ID${playerId}`]?.person;
        if (playerData) {
          const isStarter = teamData.pitchers.indexOf(playerId) === 0; // First pitcher is typically the starter
          lineups.push({
            game_id: gameData.gameData.game.pk,
            team_id: dbTeamId,
            lineup_type: 'pitching',
            batting_order: null,
            player_id: playerId,
            player_name: playerData.fullName || `Player ${playerId}`,
            position: isStarter ? 'SP' : 'RP',
            handedness: playerData.pitchHand?.code || 'R',
            is_starter: isStarter
          });
        }
      });
    }
  });

  return lineups;
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

    // Use the lineup array from boxscore - this has the correct position and handedness data
    if (teamData.lineup && Array.isArray(teamData.lineup)) {
      console.log(`📋 Found lineup array with ${teamData.lineup.length} players for ${teamType} team`);
      
      // Log sample lineup entry to verify structure
      if (teamData.lineup.length > 0) {
        console.log('🔍 Sample lineup entry:', JSON.stringify(teamData.lineup[0], null, 2));
      }
      
      teamData.lineup.forEach((player: any, index: number) => {
        if (!player.person) {
          console.log(`❌ No person data for lineup entry ${index}`);
          return;
        }

        const battingOrder = index + 1;
        const playerId = player.person.id;
        const playerName = player.person.fullName || `Player ${playerId}`;
        
        // Extract position from the correct field
        const position = player.position?.code || player.position?.abbreviation || 'OF';
        
        // Extract batting handedness from the correct field
        const handedness = player.person.batSide?.code || 'R';
        
        lineups.push({
          game_id: gameId,
          team_id: dbTeamId,
          lineup_type: 'batting',
          batting_order: battingOrder,
          player_id: playerId,
          player_name: playerName,
          position: position,
          handedness: handedness,
          is_starter: true
        });
        
        console.log(`✅ Added batter: ${playerName} (#${battingOrder}) - ${position} - ${handedness}`);
      });
    } else {
      console.log(`❌ No lineup array found for ${teamType} team`);
    }

    // Process starting pitcher separately from probablePitchers
    if (teamData.probablePitchers?.starter) {
      const pitcher = teamData.probablePitchers.starter;
      const playerId = pitcher.id;
      const playerName = pitcher.fullName || `Player ${playerId}`;
      const handedness = pitcher.pitchHand?.code || 'R';
      
      lineups.push({
        game_id: gameId,
        team_id: dbTeamId,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: playerId,
        player_name: playerName,
        position: 'SP',
        handedness: handedness,
        is_starter: true
      });
      
      console.log(`✅ Added starter: ${playerName} (SP) - ${handedness}HP`);
    } else {
      console.log(`⚠️ No probable starter found for ${teamType} team`);
    }
  });

  console.log(`✅ Extracted ${lineups.length} total lineup entries for game ${gameId}`);
  
  // Validate all lineups have correct game_id
  const validLineups = lineups.filter(lineup => lineup.game_id === gameId);
  if (validLineups.length !== lineups.length) {
    console.error(`❌ Warning: ${lineups.length - validLineups.length} lineups have incorrect game_id`);
  }
  
  return validLineups;
}
