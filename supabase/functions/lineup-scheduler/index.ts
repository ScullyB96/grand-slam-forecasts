import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP SCHEDULER FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔄 Running scheduled lineup monitoring and ingestion...');
    
    // Call the lineup monitor function
    const { data: monitorResult, error: monitorError } = await supabase.functions.invoke('lineup-monitor');
    
    if (monitorError) {
      console.error('Lineup monitor failed:', monitorError);
    } else {
      console.log('✅ Lineup monitor completed:', monitorResult);
    }
    
    // Call the lineup ingestion function to ensure all games have lineups
    const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-lineups', {
      body: { 
        date: new Date().toISOString().split('T')[0],
        force: false 
      }
    });
    
    if (ingestError) {
      console.error('Lineup ingestion failed:', ingestError);
    } else {
      console.log('✅ Lineup ingestion completed:', ingestResult);
    }
    
    // Regenerate predictions with updated lineup data
    const { data: predictionResult, error: predictionError } = await supabase.functions.invoke('generate-predictions');
    
    if (predictionError) {
      console.error('Prediction generation failed:', predictionError);
    } else {
      console.log('✅ Prediction generation completed:', predictionResult);
    }

    console.log('✅ Scheduled lineup update cycle completed successfully');

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      monitor_result: monitorResult,
      ingest_result: ingestResult,
      prediction_result: predictionResult,
      message: 'Lineup monitoring and prediction update completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Lineup scheduler failed:', error);
    
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