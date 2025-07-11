import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SCHEDULED STATCAST INGESTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Starting scheduled Statcast and game feed ingestion...');
    
    const results = {
      statcast_ingestion: null,
      game_feed_ingestion: null,
      errors: []
    };

    // 1. Ingest Statcast data for active players
    try {
      console.log('🔄 Triggering Statcast data ingestion...');
      const { data: statcastResult, error: statcastError } = await supabase.functions.invoke('ingest-statcast-data', {
        body: { season: 2025 }
      });

      if (statcastError) {
        throw statcastError;
      }

      results.statcast_ingestion = statcastResult;
      console.log('✅ Statcast ingestion completed');
    } catch (statcastError) {
      console.error('❌ Statcast ingestion failed:', statcastError);
      results.errors.push(`Statcast ingestion: ${statcastError.message}`);
    }

    // 2. Ingest game feed data for recent games
    try {
      console.log('🔄 Triggering game feed ingestion...');
      const { data: gameFeedResult, error: gameFeedError } = await supabase.functions.invoke('ingest-game-feed');

      if (gameFeedError) {
        throw gameFeedError;
      }

      results.game_feed_ingestion = gameFeedResult;
      console.log('✅ Game feed ingestion completed');
    } catch (gameFeedError) {
      console.error('❌ Game feed ingestion failed:', gameFeedError);
      results.errors.push(`Game feed ingestion: ${gameFeedError.message}`);
    }

    // 3. Optional: Update predictions with new data
    try {
      console.log('🔄 Refreshing predictions with updated data...');
      const { data: predictionsResult, error: predictionsError } = await supabase.functions.invoke('generate-predictions');

      if (predictionsError) {
        console.log('⚠️ Predictions update failed, but continuing:', predictionsError);
        results.errors.push(`Predictions update: ${predictionsError.message}`);
      } else {
        console.log('✅ Predictions refreshed');
      }
    } catch (predictionsError) {
      console.log('⚠️ Predictions update failed, but continuing:', predictionsError);
      results.errors.push(`Predictions update: ${predictionsError.message}`);
    }

    const hasErrors = results.errors.length > 0;
    console.log(hasErrors ? '⚠️ Scheduled ingestion completed with errors' : '✅ Scheduled ingestion completed successfully');

    return new Response(JSON.stringify({
      success: !hasErrors,
      timestamp: new Date().toISOString(),
      results,
      message: hasErrors 
        ? `Completed with ${results.errors.length} errors` 
        : 'All ingestion tasks completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Scheduled ingestion failed:', error);
    
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