
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameBoxscore, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP AUDIT FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Test with a specific game that should have lineups
    const testGameId = 777165; // Known game with lineup data
    console.log(`🔍 Auditing JSON payload for game ${testGameId}`);

    // Get team mapping first
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    const teamIdMapping = createTeamIdMapping(teams || []);

    // Fetch boxscore data
    console.log(`📥 Fetching boxscore data from MLB API...`);
    const boxscoreData = await getGameBoxscore(testGameId);
    
    if (!boxscoreData?.teams) {
      throw new Error('No boxscore data available from MLB API');
    }

    console.log(`✅ Boxscore data fetched successfully`);
    
    // Audit the JSON structure
    const auditResults = {
      gameId: testGameId,
      timestamp: new Date().toISOString(),
      structure: {
        hasTeams: !!boxscoreData.teams,
        homeTeam: !!boxscoreData.teams.home,
        awayTeam: !!boxscoreData.teams.away
      },
      homeTeamData: {},
      awayTeamData: {},
      sampleLineupEntry: null,
      samplePitcherEntry: null
    };

    // Analyze home team structure
    if (boxscoreData.teams.home) {
      const homeTeam = boxscoreData.teams.home;
      auditResults.homeTeamData = {
        teamName: homeTeam.team?.name,
        teamId: homeTeam.team?.id,
        hasLineup: !!homeTeam.lineup,
        lineupLength: homeTeam.lineup?.length || 0,
        hasPitchers: !!homeTeam.pitchers,
        pitchersLength: homeTeam.pitchers?.length || 0,
        availableKeys: Object.keys(homeTeam)
      };

      // Sample lineup entry
      if (homeTeam.lineup && homeTeam.lineup.length > 0) {
        const samplePlayer = homeTeam.lineup[0];
        auditResults.sampleLineupEntry = {
          raw: samplePlayer,
          person: samplePlayer.person,
          position: samplePlayer.position,
          battingOrder: samplePlayer.battingOrder,
          availablePersonFields: samplePlayer.person ? Object.keys(samplePlayer.person) : [],
          batSide: samplePlayer.person?.batSide,
          pitchHand: samplePlayer.person?.pitchHand
        };
        
        console.log(`📊 Sample home lineup entry:`, JSON.stringify(samplePlayer, null, 2));
      }

      // Sample pitcher entry
      if (homeTeam.pitchers && homeTeam.pitchers.length > 0) {
        const samplePitcher = homeTeam.pitchers[0];
        auditResults.samplePitcherEntry = {
          raw: samplePitcher,
          person: samplePitcher.person,
          availablePersonFields: samplePitcher.person ? Object.keys(samplePitcher.person) : [],
          batSide: samplePitcher.person?.batSide,
          pitchHand: samplePitcher.person?.pitchHand
        };
        
        console.log(`⚾ Sample home pitcher entry:`, JSON.stringify(samplePitcher, null, 2));
      }
    }

    // Analyze away team structure
    if (boxscoreData.teams.away) {
      const awayTeam = boxscoreData.teams.away;
      auditResults.awayTeamData = {
        teamName: awayTeam.team?.name,
        teamId: awayTeam.team?.id,
        hasLineup: !!awayTeam.lineup,
        lineupLength: awayTeam.lineup?.length || 0,
        hasPitchers: !!awayTeam.pitchers,
        pitchersLength: awayTeam.pitchers?.length || 0,
        availableKeys: Object.keys(awayTeam)
      };
    }

    console.log(`🎯 Audit Results Summary:`);
    console.log(`  - Home team lineup entries: ${auditResults.homeTeamData.lineupLength}`);
    console.log(`  - Home team pitcher entries: ${auditResults.homeTeamData.pitchersLength}`);
    console.log(`  - Away team lineup entries: ${auditResults.awayTeamData.lineupLength}`);
    console.log(`  - Away team pitcher entries: ${auditResults.awayTeamData.pitchersLength}`);

    return new Response(JSON.stringify({
      success: true,
      audit: auditResults,
      recommendations: [
        "Use boxscoreData.teams.home.lineup[] and boxscoreData.teams.away.lineup[] for batting lineups",
        "Use boxscoreData.teams.home.pitchers[] and boxscoreData.teams.away.pitchers[] for pitching lineups",
        "Extract position from player.position.code or player.position.abbreviation",
        "Extract batting handedness from player.person.batSide.code",
        "Extract pitching handedness from player.person.pitchHand.code",
        "Use player.battingOrder for batting order (not array index)",
        "Validate 9 batters per team and 1+ pitcher per team"
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup audit failed:', error);
    
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
