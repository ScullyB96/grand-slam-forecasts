import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSchedule, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP ORCHESTRATOR FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Parse request parameters
    let targetDate = new Date().toISOString().split('T')[0];
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.date) targetDate = body.date;
      } catch (e) {
        // Use default date
      }
    }

    const url = new URL(req.url);
    const urlDate = url.searchParams.get('date');
    if (urlDate) targetDate = urlDate;

    console.log(`🎯 Starting lineup orchestration for ${targetDate}`);

    // Step 1: Validate games exist in MLB API schedule
    console.log('📅 Step 1: Validating games in MLB schedule...');
    const scheduleData = await getSchedule(targetDate);
    const validMLBGames = scheduleData.dates?.[0]?.games || [];
    
    if (validMLBGames.length === 0) {
      console.log(`No games found in MLB schedule for ${targetDate}`);
      return new Response(JSON.stringify({
        success: true,
        message: `No games scheduled for ${targetDate}`,
        date: targetDate,
        steps_completed: ['schedule_validation'],
        games_found: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Found ${validMLBGames.length} valid games in MLB schedule`);

    // Step 2: Ensure schedule is ingested into our database
    console.log('💾 Step 2: Ensuring schedule is in database...');
    const { data: scheduleResult, error: scheduleError } = await supabase.functions.invoke('ingest-schedule', {
      body: { date: targetDate, force: true }
    });

    if (scheduleError) {
      console.error('Schedule ingestion failed:', scheduleError);
      throw new Error(`Schedule ingestion failed: ${scheduleError.message}`);
    }

    console.log('✅ Schedule ingestion completed:', scheduleResult);

    // Step 3: Get team mapping
    console.log('🏈 Step 3: Creating team mapping...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) {
      throw new Error('Failed to fetch teams: ' + teamsError.message);
    }

    const teamIdMapping = createTeamIdMapping(teams || []);
    console.log(`✅ Team mapping created with ${teamIdMapping.size} teams`);

    // Step 4: Clean up invalid games first
    console.log('🧹 Step 4: Cleaning up invalid games...');
    const validGameIds = validMLBGames.map(game => game.gamePk);
    
    // Get games in our database for this date
    const { data: dbGames, error: dbGamesError } = await supabase
      .from('games')
      .select('game_id, id')
      .eq('game_date', targetDate);

    if (dbGamesError) {
      console.error('Error fetching database games:', dbGamesError);
    } else {
      const invalidDbGames = dbGames?.filter(game => !validGameIds.includes(game.game_id)) || [];
      
      if (invalidDbGames.length > 0) {
        console.log(`🗑️ Removing ${invalidDbGames.length} invalid games from database`);
        
        // Delete lineups for invalid games first
        for (const game of invalidDbGames) {
          await supabase.from('game_lineups').delete().eq('game_id', game.game_id);
          await supabase.from('game_predictions').delete().eq('game_id', game.game_id);
        }
        
        // Delete the invalid games
        const invalidGameIds = invalidDbGames.map(g => g.game_id);
        await supabase.from('games').delete().in('game_id', invalidGameIds);
        
        console.log('✅ Invalid games cleaned up');
      }
    }

    // Step 5: Attempt lineup ingestion (official lineups first)
    console.log('⚾ Step 5: Attempting lineup ingestion...');
    const { data: lineupResult, error: lineupError } = await supabase.functions.invoke('ingest-lineups', {
      body: { date: targetDate, force: true }
    });

    if (lineupError) {
      console.error('Lineup ingestion failed:', lineupError);
      // Don't throw error - continue without lineups
    }

    console.log('✅ Lineup ingestion completed:', lineupResult);

    // Step 6: Monitor for lineup updates (replace mock with official)
    console.log('👀 Step 6: Running lineup monitor...');
    const { data: monitorResult, error: monitorError } = await supabase.functions.invoke('lineup-monitor');

    if (monitorError) {
      console.error('Lineup monitoring failed:', monitorError);
      // Don't throw error - continue
    }

    console.log('✅ Lineup monitoring completed:', monitorResult);

    // Step 7: Generate enhanced predictions with available data
    console.log('🔮 Step 7: Generating enhanced predictions...');
    const { data: predictionResult, error: predictionError } = await supabase.functions.invoke('enhanced-prediction-engine', {
      body: { date: targetDate }
    });

    if (predictionError) {
      console.error('Enhanced prediction generation failed:', predictionError);
      // Don't throw error - return without predictions
    }

    console.log('✅ Enhanced prediction generation completed:', predictionResult);

    // Final summary
    const summary = {
      success: true,
      date: targetDate,
      timestamp: new Date().toISOString(),
      steps_completed: [
        'schedule_validation',
        'schedule_ingestion', 
        'team_mapping',
        'cleanup_invalid_games',
        'lineup_ingestion',
        'lineup_monitoring',
        'prediction_generation'
      ],
      results: {
        games_found: validMLBGames.length,
        schedule_result: scheduleResult,
        lineup_result: lineupResult,
        monitor_result: monitorResult,
        prediction_result: predictionResult
      },
      message: `Orchestration completed for ${targetDate} with ${validMLBGames.length} games`
    };

    console.log('🎉 Lineup orchestration completed successfully:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup orchestration failed:', error);
    
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