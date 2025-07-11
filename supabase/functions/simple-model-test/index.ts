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

    console.log(`🗓️ Testing model for date: ${testDate}`);
    console.log(`📅 Current date: ${new Date().toISOString()}`);
    console.log(`📅 Yesterday calculated as: ${yesterday.toISOString()}`);

    // Step 1: Ingest schedule for yesterday
    console.log('Step 1: Ingesting schedule...');
    const { data: scheduleResult, error: scheduleError } = await supabase.functions.invoke('ingest-schedule', {
      body: { date: testDate, force: true }
    });

    if (scheduleError) {
      console.error('Schedule ingestion error:', scheduleError);
      throw new Error(`Schedule ingestion failed: ${scheduleError.message}`);
    }

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
    const { data: lineupResult, error: lineupError } = await supabase.functions.invoke('ingest-lineups', {
      body: { date: testDate, force: true }
    });

    if (lineupError) {
      console.error('Lineup ingestion error:', lineupError);
      throw new Error(`Lineup ingestion failed: ${lineupError.message}`);
    }

    console.log('Lineup result:', lineupResult);

    // Step 3: Generate predictions
    console.log('Step 3: Generating predictions...');
    const { data: predictionResult, error: predictionError } = await supabase.functions.invoke('generate-predictions', {
      body: { date: testDate, force: true }
    });

    if (predictionError) {
      console.error('Prediction generation error:', predictionError);
      throw new Error(`Prediction generation failed: ${predictionError.message}`);
    }

    console.log('Prediction result:', predictionResult);

    // Step 4: Analyze results
    console.log('Step 4: Analyzing results...');
    const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('prediction-analysis', {
      body: { 
        startDate: testDate, 
        endDate: testDate, 
        includeDetails: true 
      }
    });

    if (analysisError) {
      console.error('Analysis error:', analysisError);
      throw new Error(`Analysis failed: ${analysisError.message}`);
    }

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