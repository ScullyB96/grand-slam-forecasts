import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeatureSet {
  game_info: any;
  teams: {
    home: any;
    away: any;
  };
  lineups: {
    home_batters: any[];
    away_batters: any[];
    home_pitcher: any;
    away_pitcher: any;
  };
  player_stats: {
    batting_stats: any[];
    pitching_stats: any[];
    statcast_data: any[];
  };
  environmental: {
    park_factors: any;
    weather_data: any;
  };
  metadata: {
    created_at: string;
    feature_version: string;
    data_completeness: any;
  };
}

serve(async (req) => {
  console.log('=== FEATURE ENGINEERING FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { game_id, force_refresh = false } = await req.json();
    
    if (!game_id) {
      throw new Error('game_id is required');
    }

    console.log(`Generating feature set for game ${game_id}`);

    // Check cache first unless force refresh
    if (!force_refresh) {
      const { data: cachedFeatures } = await supabase
        .from('feature_engineering_cache')
        .select('*')
        .eq('game_id', game_id)
        .eq('feature_version', 'v2.0')
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // 6 hours
        .maybeSingle();

      if (cachedFeatures) {
        console.log('✅ Returning cached feature set');
        return new Response(JSON.stringify({
          success: true,
          features: cachedFeatures.features,
          cached: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Get game information with team details
    console.log('📊 Fetching game information...');
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation, league, division, venue_name),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation, league, division, venue_name)
      `)
      .eq('game_id', game_id)
      .single();

    if (gameError || !game) {
      throw new Error(`Game ${game_id} not found: ${gameError?.message}`);
    }

    // 2. Get lineups
    console.log('📊 Fetching lineups...');
    const { data: lineups, error: lineupsError } = await supabase
      .from('game_lineups')
      .select('*')
      .eq('game_id', game_id);

    if (lineupsError) {
      throw new Error(`Failed to fetch lineups: ${lineupsError.message}`);
    }

    // Organize lineups
    const homeBatters = lineups?.filter(p => p.team_id === game.home_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0)) || [];
    const awayBatters = lineups?.filter(p => p.team_id === game.away_team_id && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0)) || [];
    const homeStartingPitcher = lineups?.find(p => p.team_id === game.home_team_id && p.lineup_type === 'pitching' && p.is_starter);
    const awayStartingPitcher = lineups?.find(p => p.team_id === game.away_team_id && p.lineup_type === 'pitching' && p.is_starter);

    // 3. Get all player IDs
    const allPlayerIds = [...homeBatters, ...awayBatters]
      .map(p => p.player_id)
      .concat([homeStartingPitcher?.player_id, awayStartingPitcher?.player_id].filter(Boolean));

    console.log(`📊 Fetching stats for ${allPlayerIds.length} players...`);

    // 4. Fetch traditional stats (with 2024 fallback)
    let { data: battingStats } = await supabase
      .from('batting_stats')
      .select('*')
      .in('player_id', allPlayerIds)
      .eq('season', 2025);

    if (!battingStats || battingStats.length === 0) {
      const { data: fallbackBatting } = await supabase
        .from('batting_stats')
        .select('*')
        .in('player_id', allPlayerIds)
        .eq('season', 2024);
      battingStats = fallbackBatting || [];
    }

    let { data: pitchingStats } = await supabase
      .from('pitching_stats')
      .select('*')
      .in('player_id', allPlayerIds)
      .eq('season', 2025);

    if (!pitchingStats || pitchingStats.length === 0) {
      const { data: fallbackPitching } = await supabase
        .from('pitching_stats')
        .select('*')
        .in('player_id', allPlayerIds)
        .eq('season', 2024);
      pitchingStats = fallbackPitching || [];
    }

    // 5. Fetch Statcast data (with 2024 fallback)
    let { data: statcastData } = await supabase
      .from('player_statcast')
      .select('*')
      .in('player_id', allPlayerIds)
      .eq('season', 2025);

    if (!statcastData || statcastData.length === 0) {
      const { data: fallbackStatcast } = await supabase
        .from('player_statcast')
        .select('*')
        .in('player_id', allPlayerIds)
        .eq('season', 2024);
      statcastData = fallbackStatcast || [];
    }

    // 6. Get team stats
    console.log('📊 Fetching team stats...');
    const { data: teamStats } = await supabase
      .from('team_stats')
      .select('*')
      .in('team_id', [game.home_team_id, game.away_team_id])
      .eq('season', 2025);

    // 7. Get park factors
    console.log('📊 Fetching park factors...');
    const { data: parkFactors } = await supabase
      .from('park_factors')
      .select('*')
      .eq('venue_name', game.venue_name)
      .eq('season', 2025)
      .maybeSingle();

    // 8. Get weather data
    console.log('📊 Fetching weather data...');
    const { data: weatherData } = await supabase
      .from('weather_data')
      .select('*')
      .eq('game_id', game_id)
      .maybeSingle();

    // 9. Calculate data completeness metrics
    const totalBatters = homeBatters.length + awayBatters.length;
    const battersWithStats = battingStats?.length || 0;
    const battersWithStatcast = statcastData?.filter(s => [...homeBatters, ...awayBatters].some(b => b.player_id === s.player_id)).length || 0;
    const pitchersWithStats = pitchingStats?.length || 0;
    const pitchersWithStatcast = statcastData?.filter(s => [homeStartingPitcher?.player_id, awayStartingPitcher?.player_id].includes(s.player_id)).length || 0;

    const dataCompleteness = {
      batting_stats_coverage: totalBatters > 0 ? battersWithStats / totalBatters : 0,
      batting_statcast_coverage: totalBatters > 0 ? battersWithStatcast / totalBatters : 0,
      pitching_stats_coverage: 2 > 0 ? pitchersWithStats / 2 : 0,
      pitching_statcast_coverage: 2 > 0 ? pitchersWithStatcast / 2 : 0,
      has_park_factors: !!parkFactors,
      has_weather_data: !!weatherData,
      overall_score: 0
    };

    dataCompleteness.overall_score = (
      dataCompleteness.batting_stats_coverage * 0.25 +
      dataCompleteness.batting_statcast_coverage * 0.30 +
      dataCompleteness.pitching_stats_coverage * 0.25 +
      dataCompleteness.pitching_statcast_coverage * 0.15 +
      (dataCompleteness.has_park_factors ? 1 : 0) * 0.03 +
      (dataCompleteness.has_weather_data ? 1 : 0) * 0.02
    );

    // 10. Build feature set
    const featureSet: FeatureSet = {
      game_info: {
        game_id: game.game_id,
        game_date: game.game_date,
        venue_name: game.venue_name,
        status: game.status
      },
      teams: {
        home: {
          ...game.home_team,
          stats: teamStats?.find(t => t.team_id === game.home_team_id)
        },
        away: {
          ...game.away_team,
          stats: teamStats?.find(t => t.team_id === game.away_team_id)
        }
      },
      lineups: {
        home_batters: homeBatters,
        away_batters: awayBatters,
        home_pitcher: homeStartingPitcher,
        away_pitcher: awayStartingPitcher
      },
      player_stats: {
        batting_stats: battingStats || [],
        pitching_stats: pitchingStats || [],
        statcast_data: statcastData || []
      },
      environmental: {
        park_factors: parkFactors,
        weather_data: weatherData
      },
      metadata: {
        created_at: new Date().toISOString(),
        feature_version: 'v2.0',
        data_completeness: dataCompleteness
      }
    };

    // 11. Cache the feature set
    console.log('💾 Caching feature set...');
    await supabase
      .from('feature_engineering_cache')
      .upsert({
        game_id: game_id,
        game_date: game.game_date,
        team_id: game.home_team_id, // Use home team as primary
        features: featureSet,
        feature_version: 'v2.0'
      }, {
        onConflict: 'game_id,feature_version'
      });

    console.log('✅ Feature engineering completed');
    console.log(`📊 Data completeness: ${Math.round(dataCompleteness.overall_score * 100)}%`);

    return new Response(JSON.stringify({
      success: true,
      features: featureSet,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Feature engineering failed:', error);
    
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