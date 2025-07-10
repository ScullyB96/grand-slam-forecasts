import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== MANUAL LINEUP TRIGGER FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔄 Manually triggering lineup ingestion for today...');
    
    // Call the lineup ingestion function for today's games
    const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-lineups', {
      body: { 
        date: new Date().toISOString().split('T')[0],
        force: true  // Force regeneration of all lineups
      }
    });
    
    if (ingestError) {
      console.error('Lineup ingestion failed:', ingestError);
      throw ingestError;
    }
    
    console.log('✅ Lineup ingestion completed:', ingestResult);
    
    // Also regenerate predictions with the new lineup data
    const { data: predictionResult, error: predictionError } = await supabase.functions.invoke('generate-predictions');
    
    if (predictionError) {
      console.error('Prediction generation failed:', predictionError);
    } else {
      console.log('✅ Prediction generation completed:', predictionResult);
    }

    console.log('✅ Manual lineup trigger completed successfully');

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      ingest_result: ingestResult,
      prediction_result: predictionResult,
      message: 'Manual lineup ingestion and prediction update completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manual lineup trigger failed:', error);
    
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