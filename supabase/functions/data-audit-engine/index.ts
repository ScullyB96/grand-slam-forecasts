import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DataAuditResult {
  audit_type: string;
  data_source: string;
  status: 'pass' | 'fail' | 'warning';
  metrics: Record<string, any>;
  anomalies: Record<string, any>;
  error_details?: string;
  completeness_score: number;
}

interface MockDataConfig {
  team_stats: boolean;
  park_factors: boolean;
  weather_data: boolean;
  bullpen_stats: boolean;
}

serve(async (req) => {
  console.log('=== DATA AUDIT & DIAGNOSTICS ENGINE ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { target_date, enable_mock_fallback = false } = requestBody;
    
    const auditDate = target_date || new Date().toISOString().split('T')[0];
    console.log(`Starting comprehensive data audit for ${auditDate}`);

    // Initialize audit results
    const auditResults: DataAuditResult[] = [];
    const mockConfig: MockDataConfig = {
      team_stats: false,
      park_factors: false,
      weather_data: false,
      bullpen_stats: false
    };

    // 1. AUDIT TEAM STATISTICS
    console.log('🔍 Auditing team statistics...');
    const teamStatsAudit = await auditTeamStats(supabase, auditDate);
    auditResults.push(teamStatsAudit);
    
    if (teamStatsAudit.status === 'fail' && enable_mock_fallback) {
      console.log('📊 Generating mock team stats fallback...');
      await generateMockTeamStats(supabase);
      mockConfig.team_stats = true;
    }

    // 2. AUDIT PARK FACTORS
    console.log('🏟️ Auditing park factors...');
    const parkFactorsAudit = await auditParkFactors(supabase, auditDate);
    auditResults.push(parkFactorsAudit);
    
    if (parkFactorsAudit.status === 'fail' && enable_mock_fallback) {
      console.log('🏟️ Generating mock park factors fallback...');
      await generateMockParkFactors(supabase);
      mockConfig.park_factors = true;
    }

    // 3. AUDIT WEATHER DATA
    console.log('🌤️ Auditing weather data...');
    const weatherAudit = await auditWeatherData(supabase, auditDate);
    auditResults.push(weatherAudit);
    
    if (weatherAudit.status === 'fail' && enable_mock_fallback) {
      console.log('🌤️ Generating mock weather data fallback...');
      await generateMockWeatherData(supabase, auditDate);
      mockConfig.weather_data = true;
    }

    // 4. AUDIT BULLPEN STATISTICS
    console.log('⚾ Auditing bullpen statistics...');
    const bullpenAudit = await auditBullpenStats(supabase);
    auditResults.push(bullpenAudit);
    
    if (bullpenAudit.status === 'fail' && enable_mock_fallback) {
      console.log('⚾ Generating mock bullpen stats fallback...');
      await generateMockBullpenStats(supabase);
      mockConfig.bullpen_stats = true;
    }

    // 5. COMPREHENSIVE DATA CONSISTENCY CHECK
    console.log('🔗 Performing consistency checks...');
    const consistencyAudit = await auditDataConsistency(supabase, auditDate);
    auditResults.push(consistencyAudit);

    // Save audit results to database
    console.log('💾 Saving audit results...');
    for (const result of auditResults) {
      await supabase
        .from('data_audit_results')
        .upsert({
          ...result,
          audit_date: new Date().toISOString()
        }, {
          onConflict: 'audit_type,data_source,audit_date',
          ignoreDuplicates: false
        });
    }

    // Calculate overall system health
    const totalAudits = auditResults.length;
    const passedAudits = auditResults.filter(r => r.status === 'pass').length;
    const failedAudits = auditResults.filter(r => r.status === 'fail').length;
    const warningAudits = auditResults.filter(r => r.status === 'warning').length;
    
    const healthScore = passedAudits / totalAudits;
    const overallStatus = failedAudits > 0 ? 'degraded' : warningAudits > 0 ? 'warning' : 'healthy';

    console.log(`✅ Data audit complete. Health Score: ${(healthScore * 100).toFixed(1)}%`);

    return new Response(JSON.stringify({
      success: true,
      audit_date: auditDate,
      overall_status: overallStatus,
      health_score: healthScore,
      audit_results: auditResults,
      mock_fallbacks_used: mockConfig,
      summary: {
        total_audits: totalAudits,
        passed: passedAudits,
        failed: failedAudits,
        warnings: warningAudits
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Data audit failed:', error);
    
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

async function auditTeamStats(supabase: any, auditDate: string): Promise<DataAuditResult> {
  try {
    const currentSeason = new Date(auditDate).getFullYear();
    
    // Check completeness
    const { data: teamCount } = await supabase
      .from('teams')
      .select('id', { count: 'exact' });
    
    const { data: statsCount } = await supabase
      .from('team_stats')
      .select('team_id', { count: 'exact' })
      .eq('season', currentSeason);

    const totalTeams = teamCount?.length || 0;
    const teamsWithStats = statsCount?.length || 0;
    const completeness = totalTeams > 0 ? teamsWithStats / totalTeams : 0;

    // Check for anomalies
    const { data: stats } = await supabase
      .from('team_stats')
      .select('*')
      .eq('season', currentSeason);

    const anomalies = detectStatsAnomalies(stats || []);
    
    return {
      audit_type: 'completeness_and_quality',
      data_source: 'team_stats',
      status: completeness >= 0.9 ? 'pass' : completeness >= 0.7 ? 'warning' : 'fail',
      metrics: {
        total_teams: totalTeams,
        teams_with_stats: teamsWithStats,
        completeness_percentage: (completeness * 100).toFixed(1),
        average_era: stats?.reduce((sum, s) => sum + (s.team_era || 0), 0) / (stats?.length || 1),
        average_avg: stats?.reduce((sum, s) => sum + (s.team_avg || 0), 0) / (stats?.length || 1)
      },
      anomalies,
      completeness_score: completeness
    };

  } catch (error) {
    return {
      audit_type: 'completeness_and_quality',
      data_source: 'team_stats',
      status: 'fail',
      metrics: {},
      anomalies: {},
      error_details: error.message,
      completeness_score: 0
    };
  }
}

async function auditParkFactors(supabase: any, auditDate: string): Promise<DataAuditResult> {
  try {
    const currentSeason = new Date(auditDate).getFullYear();
    
    // Get unique venues from games
    const { data: venues } = await supabase
      .from('games')
      .select('venue_name')
      .not('venue_name', 'is', null);

    const uniqueVenues = [...new Set(venues?.map(v => v.venue_name) || [])];
    
    // Check park factors coverage
    const { data: parkFactors } = await supabase
      .from('park_factors')
      .select('venue_name')
      .eq('season', currentSeason);

    const venuesWithFactors = parkFactors?.length || 0;
    const completeness = uniqueVenues.length > 0 ? venuesWithFactors / uniqueVenues.length : 0;

    // Check for reasonable factor ranges
    const { data: factors } = await supabase
      .from('park_factors')
      .select('*')
      .eq('season', currentSeason);

    const anomalies = detectParkFactorAnomalies(factors || []);

    return {
      audit_type: 'completeness_and_quality',
      data_source: 'park_factors',
      status: completeness >= 0.9 ? 'pass' : completeness >= 0.7 ? 'warning' : 'fail',
      metrics: {
        total_venues: uniqueVenues.length,
        venues_with_factors: venuesWithFactors,
        completeness_percentage: (completeness * 100).toFixed(1),
        avg_runs_factor: factors?.reduce((sum, f) => sum + (f.runs_factor || 1), 0) / (factors?.length || 1)
      },
      anomalies,
      completeness_score: completeness
    };

  } catch (error) {
    return {
      audit_type: 'completeness_and_quality',
      data_source: 'park_factors',
      status: 'fail',
      metrics: {},
      anomalies: {},
      error_details: error.message,
      completeness_score: 0
    };
  }
}

async function auditWeatherData(supabase: any, auditDate: string): Promise<DataAuditResult> {
  try {
    // Get upcoming games
    const { data: games } = await supabase
      .from('games')
      .select('game_id')
      .gte('game_date', auditDate)
      .lte('game_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Check weather data coverage
    const { data: weatherData } = await supabase
      .from('weather_data')
      .select('game_id')
      .in('game_id', games?.map(g => g.game_id) || []);

    const totalGames = games?.length || 0;
    const gamesWithWeather = weatherData?.length || 0;
    const completeness = totalGames > 0 ? gamesWithWeather / totalGames : 0;

    return {
      audit_type: 'completeness_and_quality',
      data_source: 'weather_data',
      status: completeness >= 0.8 ? 'pass' : completeness >= 0.6 ? 'warning' : 'fail',
      metrics: {
        upcoming_games: totalGames,
        games_with_weather: gamesWithWeather,
        completeness_percentage: (completeness * 100).toFixed(1)
      },
      anomalies: {},
      completeness_score: completeness
    };

  } catch (error) {
    return {
      audit_type: 'completeness_and_quality',
      data_source: 'weather_data',
      status: 'fail',
      metrics: {},
      anomalies: {},
      error_details: error.message,
      completeness_score: 0
    };
  }
}

async function auditBullpenStats(supabase: any): Promise<DataAuditResult> {
  try {
    const currentSeason = new Date().getFullYear();
    
    const { data: teamCount } = await supabase
      .from('teams')
      .select('id', { count: 'exact' });
    
    const { data: bullpenCount } = await supabase
      .from('bullpen_stats')
      .select('team_id', { count: 'exact' })
      .eq('season', currentSeason);

    const totalTeams = teamCount?.length || 0;
    const teamsWithBullpen = bullpenCount?.length || 0;
    const completeness = totalTeams > 0 ? teamsWithBullpen / totalTeams : 0;

    return {
      audit_type: 'completeness_and_quality',
      data_source: 'bullpen_stats',
      status: completeness >= 0.8 ? 'pass' : completeness >= 0.6 ? 'warning' : 'fail',
      metrics: {
        total_teams: totalTeams,
        teams_with_bullpen_stats: teamsWithBullpen,
        completeness_percentage: (completeness * 100).toFixed(1)
      },
      anomalies: {},
      completeness_score: completeness
    };

  } catch (error) {
    return {
      audit_type: 'completeness_and_quality',
      data_source: 'bullpen_stats',
      status: 'fail',
      metrics: {},
      anomalies: {},
      error_details: error.message,
      completeness_score: 0
    };
  }
}

async function auditDataConsistency(supabase: any, auditDate: string): Promise<DataAuditResult> {
  try {
    // Check referential integrity and data consistency
    const issues: string[] = [];
    
    // Check games have valid team references
    const { data: orphanGames } = await supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id')
      .or('home_team_id.not.in.(select id from teams),away_team_id.not.in.(select id from teams)');

    if (orphanGames?.length > 0) {
      issues.push(`${orphanGames.length} games have invalid team references`);
    }

    // Check for duplicate game IDs
    const { data: games } = await supabase
      .from('games')
      .select('game_id')
      .gte('game_date', auditDate);

    const gameIds = games?.map(g => g.game_id) || [];
    const uniqueGameIds = new Set(gameIds);
    if (gameIds.length !== uniqueGameIds.size) {
      issues.push('Duplicate game IDs detected');
    }

    return {
      audit_type: 'consistency_check',
      data_source: 'cross_table_validation',
      status: issues.length === 0 ? 'pass' : 'warning',
      metrics: {
        total_games_checked: games?.length || 0,
        orphan_games: orphanGames?.length || 0,
        duplicate_game_ids: gameIds.length - uniqueGameIds.size
      },
      anomalies: { issues },
      completeness_score: issues.length === 0 ? 1.0 : 0.8
    };

  } catch (error) {
    return {
      audit_type: 'consistency_check',
      data_source: 'cross_table_validation',
      status: 'fail',
      metrics: {},
      anomalies: {},
      error_details: error.message,
      completeness_score: 0
    };
  }
}

// Anomaly detection functions
function detectStatsAnomalies(stats: any[]): Record<string, any> {
  const anomalies: any = {};
  
  // Check for unrealistic ERAs
  const highEras = stats.filter(s => s.team_era > 6.0);
  const lowEras = stats.filter(s => s.team_era < 2.0);
  
  if (highEras.length > 0) anomalies.high_era_teams = highEras.length;
  if (lowEras.length > 0) anomalies.low_era_teams = lowEras.length;
  
  // Check for unrealistic batting averages
  const highAvgs = stats.filter(s => s.team_avg > 0.300);
  const lowAvgs = stats.filter(s => s.team_avg < 0.200);
  
  if (highAvgs.length > 0) anomalies.high_avg_teams = highAvgs.length;
  if (lowAvgs.length > 0) anomalies.low_avg_teams = lowAvgs.length;
  
  return anomalies;
}

function detectParkFactorAnomalies(factors: any[]): Record<string, any> {
  const anomalies: any = {};
  
  // Check for extreme park factors
  const extremeFactors = factors.filter(f => 
    f.runs_factor > 1.3 || f.runs_factor < 0.7 ||
    f.hr_factor > 1.4 || f.hr_factor < 0.6
  );
  
  if (extremeFactors.length > 0) {
    anomalies.extreme_factors = extremeFactors.map(f => f.venue_name);
  }
  
  return anomalies;
}

// Mock data generation functions (fallback only)
async function generateMockTeamStats(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, team_id');
  const currentSeason = new Date().getFullYear();
  
  for (const team of teams || []) {
    const mockStats = {
      team_id: team.id,
      season: currentSeason,
      wins: 40 + Math.floor(Math.random() * 40),
      losses: 40 + Math.floor(Math.random() * 40),
      runs_scored: 400 + Math.floor(Math.random() * 300),
      runs_allowed: 400 + Math.floor(Math.random() * 300),
      team_era: 3.5 + Math.random() * 2,
      team_avg: 0.22 + Math.random() * 0.08,
      team_obp: 0.30 + Math.random() * 0.08,
      team_slg: 0.35 + Math.random() * 0.15
    };
    
    await supabase
      .from('team_stats')
      .upsert(mockStats, { 
        onConflict: 'team_id,season',
        ignoreDuplicates: false 
      });
  }
}

async function generateMockParkFactors(supabase: any) {
  const { data: venues } = await supabase
    .from('games')
    .select('venue_name')
    .not('venue_name', 'is', null);
    
  const uniqueVenues = [...new Set(venues?.map(v => v.venue_name) || [])];
  const currentSeason = new Date().getFullYear();
  
  for (const venue of uniqueVenues) {
    const mockFactors = {
      venue_name: venue,
      season: currentSeason,
      runs_factor: 0.9 + Math.random() * 0.2,
      hr_factor: 0.85 + Math.random() * 0.3,
      hits_factor: 0.95 + Math.random() * 0.1
    };
    
    await supabase
      .from('park_factors')
      .upsert(mockFactors, {
        onConflict: 'venue_name,season',
        ignoreDuplicates: false
      });
  }
}

async function generateMockWeatherData(supabase: any, auditDate: string) {
  const { data: games } = await supabase
    .from('games')
    .select('game_id')
    .gte('game_date', auditDate)
    .lte('game_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  for (const game of games || []) {
    const mockWeather = {
      game_id: game.game_id,
      temperature_f: 65 + Math.random() * 25,
      condition: ['Clear', 'Partly Cloudy', 'Overcast'][Math.floor(Math.random() * 3)],
      wind_speed_mph: 3 + Math.random() * 12,
      wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      humidity_percent: 40 + Math.floor(Math.random() * 40)
    };
    
    await supabase
      .from('weather_data')
      .upsert(mockWeather, {
        onConflict: 'game_id',
        ignoreDuplicates: false
      });
  }
}

async function generateMockBullpenStats(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id');
  const currentSeason = new Date().getFullYear();
  
  for (const team of teams || []) {
    const mockBullpen = {
      team_id: team.id,
      season: currentSeason,
      saves: Math.floor(Math.random() * 50),
      blown_saves: Math.floor(Math.random() * 15),
      holds: Math.floor(Math.random() * 40),
      era: 3.0 + Math.random() * 2.5,
      whip: 1.1 + Math.random() * 0.4
    };
    
    await supabase
      .from('bullpen_stats')
      .upsert(mockBullpen, {
        onConflict: 'team_id,season',
        ignoreDuplicates: false
      });
  }
}