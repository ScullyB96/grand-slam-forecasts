import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SIMPLE MODEL TEST FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const testDate = yesterday.toISOString().split('T')[0];

    console.log(`Testing model for date: ${testDate}`);

    // Step 1: Ingest schedule for yesterday
    console.log('Step 1: Ingesting schedule...');
    const scheduleResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ingest-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      },
      body: JSON.stringify({ date: testDate, force: true })
    });

    const scheduleResult = await scheduleResponse.json();
    console.log('Schedule result:', scheduleResult);

    if (!scheduleResult.success || scheduleResult.gamesProcessed === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `No games found for ${testDate}. Schedule result: ${JSON.stringify(scheduleResult)}`,
        testDate
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Ingest lineups for yesterday
    console.log('Step 2: Ingesting lineups...');
    const lineupResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ingest-lineups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      },
      body: JSON.stringify({ date: testDate, force: true })
    });

    const lineupResult = await lineupResponse.json();
    console.log('Lineup result:', lineupResult);

    // Step 3: Generate predictions
    console.log('Step 3: Generating predictions...');
    const predictionResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      },
      body: JSON.stringify({ date: testDate, force: true })
    });

    const predictionResult = await predictionResponse.json();
    console.log('Prediction result:', predictionResult);

    // Step 4: Analyze results
    console.log('Step 4: Analyzing results...');
    const analysisResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/prediction-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      },
      body: JSON.stringify({ 
        startDate: testDate, 
        endDate: testDate, 
        includeDetails: true 
      })
    });

    const analysisResult = await analysisResponse.json();
    console.log('Analysis result:', analysisResult);

    // Return comprehensive results
    return new Response(JSON.stringify({
      success: true,
      testDate,
      steps: {
        schedule: {
          success: scheduleResult.success,
          gamesFound: scheduleResult.gamesProcessed || 0,
          errors: scheduleResult.errors || 0
        },
        lineups: {
          success: lineupResult.success,
          playersFound: lineupResult.processed || 0,
          errors: lineupResult.errors || 0
        },
        predictions: {
          success: predictionResult.success,
          predictionsGenerated: predictionResult.generated || 0,
          errors: predictionResult.errors || 0
        },
        analysis: analysisResult.success ? {
          totalGames: analysisResult.total_games,
          gamesWithPredictions: analysisResult.games_with_predictions,
          accuracy: `${analysisResult.accuracy_percentage?.toFixed(1)}%`,
          avgConfidence: analysisResult.avg_confidence_score?.toFixed(2),
          avgScoreError: analysisResult.avg_score_error?.toFixed(2),
          details: analysisResult.details?.slice(0, 5) // Show first 5 games
        } : { error: analysisResult.error }
      },
      message: `Model test completed for ${testDate}. Found ${scheduleResult.gamesProcessed} games, ${lineupResult.processed} players, generated ${predictionResult.generated} predictions.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Model test failed:', error);
    
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