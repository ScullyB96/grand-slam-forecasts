/**
 * Centralized MLB Stats API helper functions
 * All MLB API calls should go through these functions for consistency
 */

const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 100; // 100ms between requests
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

async function makeMLBRequest(endpoint: string, params: Record<string, any> = {}) {
  await rateLimit();
  
  const url = new URL(`${MLB_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  console.log(`MLB API Request: ${url.toString()}`);
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} - ${response.statusText} for ${url.toString()}`);
  }
  
  return response.json();
}

/**
 * Get comprehensive team statistics for hitting and pitching
 */
export async function getTeamStats(season: number = new Date().getFullYear()) {
  console.log(`Fetching team stats for season ${season}`);
  
  // Get hitting stats
  const hittingStats = await makeMLBRequest('/stats', {
    stats: 'season',
    group: 'hitting',
    season: season,
    sportId: 1 // MLB
  });

  // Get pitching stats  
  const pitchingStats = await makeMLBRequest('/stats', {
    stats: 'season',
    group: 'pitching',
    season: season,
    sportId: 1 // MLB
  });

  // Get team records from standings
  const standings = await makeMLBRequest('/standings', {
    leagueId: '103,104', // AL and NL
    season: season,
    standingsTypes: 'regularSeason'
  });

  return {
    hitting: hittingStats,
    pitching: pitchingStats,
    standings: standings
  };
}

/**
 * Get live game data including weather information
 */
export async function getGameLiveData(gamePk: number) {
  console.log(`Fetching live data for game ${gamePk}`);
  
  const gameData = await makeMLBRequest(`/game/${gamePk}/feed/live`);
  return gameData;
}

/**
 * Get game weather data from live feed
 */
export async function getGameWeather(gamePk: number) {
  try {
    const liveData = await getGameLiveData(gamePk);
    
    if (liveData?.gameData?.weather) {
      return {
        temperature: liveData.gameData.weather.temp || null,
        condition: liveData.gameData.weather.condition || null,
        wind: liveData.gameData.weather.wind || null,
        humidity: liveData.gameData.weather.humidity || null
      };
    }
    
    console.warn(`No weather data found for game ${gamePk}`);
    return null;
  } catch (error) {
    console.error(`Failed to get weather for game ${gamePk}:`, error);
    return null;
  }
}

/**
 * Get detailed schedule with game IDs and probable pitchers
 */
export async function getSchedule(date: string, sportId: number = 1) {
  console.log(`Fetching schedule for date ${date}`);
  
  return await makeMLBRequest('/schedule', {
    sportId,
    date,
    hydrate: 'team,linescore,probablePitcher(note)'
  });
}

/**
 * Get detailed game data including lineups and probable pitchers
 */
export async function getGameLineups(gamePk: number) {
  console.log(`Fetching game lineups for game ${gamePk}`);
  
  const gameData = await makeMLBRequest(`/game/${gamePk}/feed/live`);
  return gameData;
}

/**
 * Extract lineups from game live feed
 */
export function extractLineupsFromGameFeed(gameData: any, teamIdMap?: Map<number, number>) {
  const lineups: any[] = [];
  
  if (!gameData?.liveData?.boxscore?.teams) {
    console.log('No boxscore data available yet');
    return lineups;
  }

  const teams = gameData.liveData.boxscore.teams;
  const gameInfo = gameData.gameData;
  
  // Process home and away teams
  ['home', 'away'].forEach(teamType => {
    const teamData = teams[teamType];
    const teamInfo = gameInfo.teams[teamType];
    
    if (!teamData?.batters || teamData.batters.length === 0) {
      console.log(`No ${teamType} batting lineup available yet`);
      return;
    }

    // Map MLB team ID to our database team ID
    const mlbTeamId = teamInfo.id;
    const dbTeamId = teamIdMap?.get(mlbTeamId) || mlbTeamId;
    
    console.log(`Mapping team ${teamInfo.name} from MLB ID ${mlbTeamId} to DB ID ${dbTeamId}`);

    // Extract batting lineup
    teamData.batters.forEach((playerId: number, index: number) => {
      const playerInfo = teamData.players[`ID${playerId}`];
      if (playerInfo && index < 9) { // Only first 9 are batting order
        lineups.push({
          game_id: parseInt(gameInfo.pk),
          team_id: dbTeamId,
          lineup_type: 'batting',
          batting_order: index + 1,
          player_id: playerId,
          player_name: playerInfo.person.fullName,
          position: playerInfo.position?.abbreviation || 'Unknown',
          handedness: playerInfo.person.batSide?.code || 'R',
          is_starter: true
        });
      }
    });

    // Extract probable pitcher
    const probablePitcher = gameInfo.probablePitchers?.[teamType];
    if (probablePitcher) {
      lineups.push({
        game_id: parseInt(gameInfo.pk),
        team_id: dbTeamId,
        lineup_type: 'pitching',
        batting_order: null,
        player_id: probablePitcher.id,
        player_name: probablePitcher.fullName,
        position: 'SP',
        handedness: probablePitcher.pitchHand?.code || 'R',
        is_starter: true
      });
    }
  });

  return lineups;
}

/**
 * Create a mapping from MLB team IDs to database team IDs
 */
export function createTeamIdMapping(teams: any[]): Map<number, number> {
  const mapping = new Map<number, number>();
  
  teams.forEach(team => {
    if (team.team_id && team.id) {
      mapping.set(team.team_id, team.id);
    }
  });
  
  console.log('Created team ID mapping:', Array.from(mapping.entries()));
  return mapping;
}

/**
 * Get all teams with venue information
 */
export async function getTeams(season: number = new Date().getFullYear()) {
  console.log(`Fetching teams for season ${season}`);
  
  return await makeMLBRequest('/teams', {
    sportId: 1, // MLB
    season
  });
}

/**
 * Get venue details including dimensions and characteristics
 */
export async function getVenue(venueId: number) {
  console.log(`Fetching venue details for venue ${venueId}`);
  
  return await makeMLBRequest(`/venues/${venueId}`);
}

/**
 * Get detailed player statistics
 */
export async function getPlayerStats(playerId: number, season: number, statType: 'hitting' | 'pitching') {
  console.log(`Fetching ${statType} stats for player ${playerId} in season ${season}`);
  
  return await makeMLBRequest(`/people/${playerId}/stats`, {
    stats: 'season',
    group: statType,
    season
  });
}

/**
 * Extract team statistics from API response
 */
export function extractTeamStatsFromAPI(hittingData: any, pitchingData: any, standingsData: any) {
  const teamStats = new Map();
  
  // Process standings for W-L records and runs
  standingsData.records?.forEach((division: any) => {
    division.teamRecords?.forEach((teamRecord: any) => {
      const mlbTeamId = teamRecord.team.id;
      teamStats.set(mlbTeamId, {
        wins: teamRecord.wins || 0,
        losses: teamRecord.losses || 0,
        runsScored: teamRecord.runsScored || 0,
        runsAllowed: teamRecord.runsAllowed || 0,
        team_avg: 0.250, // Default, will be overridden
        team_obp: 0.320,
        team_slg: 0.400,
        team_era: 4.50
      });
    });
  });

  // Process hitting stats
  hittingData.stats?.forEach((statGroup: any) => {
    statGroup.splits?.forEach((split: any) => {
      if (split.team?.id) {
        const mlbTeamId = split.team.id;
        const existing = teamStats.get(mlbTeamId) || {};
        teamStats.set(mlbTeamId, {
          ...existing,
          team_avg: parseFloat(split.stat?.avg) || 0.250,
          team_obp: parseFloat(split.stat?.obp) || 0.320,
          team_slg: parseFloat(split.stat?.slg) || 0.400
        });
      }
    });
  });

  // Process pitching stats
  pitchingData.stats?.forEach((statGroup: any) => {
    statGroup.splits?.forEach((split: any) => {
      if (split.team?.id) {
        const mlbTeamId = split.team.id;
        const existing = teamStats.get(mlbTeamId) || {};
        teamStats.set(mlbTeamId, {
          ...existing,
          team_era: parseFloat(split.stat?.era) || 4.50
        });
      }
    });
  });

  return teamStats;
}

/**
 * Parse weather data from MLB live game feed
 */
export function parseWeatherFromGameFeed(gameData: any) {
  const weather = gameData?.gameData?.weather;
  if (!weather) return null;

  return {
    temperature_f: parseFloat(weather.temp) || null,
    condition: weather.condition || null,
    wind_speed_mph: parseFloat(weather.wind?.split(' ')[0]) || null,
    wind_direction: weather.wind?.split(' ')[1] || null,
    humidity_percent: parseInt(weather.humidity?.replace('%', '')) || null
  };
}