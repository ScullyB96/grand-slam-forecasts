// supabase/functions/shared/mlb-api.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";

export async function getSchedule(date: string) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const response = await fetch(url);
  return await response.json();
}

export async function getGameLineups(gamePk: number) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MLB API error for gamePk ${gamePk}: ${response.status}`);
  }
  return await response.json();
}

export async function getGameBoxscore(gamePk: number) {
    const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`MLB API error for gamePk ${gamePk}: ${response.status}`);
    }
    return await response.json();
}

export function createTeamIdMapping(teams: { id: number, team_id: number }[]): Map<number, number> {
  const teamIdMapping = new Map<number, number>();
  teams.forEach(team => {
    if (team.team_id) {
      teamIdMapping.set(team.team_id, team.id);
    }
  });
  return teamIdMapping;
}

const positionCodeMap: { [key: string]: string } = {
  '1': 'P', '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS',
  '7': 'LF', '8': 'CF', '9': 'RF', '10': 'DH', '11': 'PH', '12': 'PR'
};

function mapPositionCode(positionCode: string | number): string {
  return positionCodeMap[String(positionCode)] || String(positionCode);
}

export function extractLineupsFromGameFeed(gameData: any, teamIdMapping: Map<number, number>): any[] {
  const gameId = gameData?.gameData?.game?.pk;
  if (!gameId || !gameData?.liveData?.boxscore?.teams) {
    console.log('No valid lineup data in game feed.');
    return [];
  }

  const lineups: any[] = [];
  const { home, away } = gameData.liveData.boxscore.teams;

  [home, away].forEach(teamData => {
    const mlbTeamId = teamData.team?.id;
    if (!mlbTeamId) return;

    const dbTeamId = teamIdMapping.get(mlbTeamId);
    if (!dbTeamId) {
      console.warn(`No DB mapping for MLB team ID: ${mlbTeamId}`);
      return;
    }

    // Process Batting Lineup
    if (teamData.batters && teamData.players) {
      const batterIds = teamData.batters;
      batterIds.forEach((playerId: number, index: number) => {
        const playerKey = `ID${playerId}`;
        const player = teamData.players[playerKey];
        if (player && player.person) {
          lineups.push({
            game_id: gameId,
            team_id: dbTeamId,
            lineup_type: 'batting',
            batting_order: index + 1,
            player_id: player.person.id,
            player_name: player.person.fullName,
            position: player.position?.abbreviation || 'N/A',
            handedness: player.batSide?.code || 'U',
            is_starter: true
          });
        }
      });
    }

    // Process Pitching Lineup
    if (teamData.pitchers && teamData.players) {
      const pitcherIds = teamData.pitchers;
      pitcherIds.forEach((playerId: number, index: number) => {
        const playerKey = `ID${playerId}`;
        const player = teamData.players[playerKey];
        if (player && player.person) {
          const isStarter = index === 0;
          lineups.push({
            game_id: gameId,
            team_id: dbTeamId,
            lineup_type: 'pitching',
            batting_order: null,
            player_id: player.person.id,
            player_name: player.person.fullName,
            position: isStarter ? 'SP' : 'RP',
            handedness: player.pitchHand?.code || 'U',
            is_starter: isStarter
          });
        }
      });
    }
  });

  return lineups;
}