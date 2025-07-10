
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
    // This function sets up the daily lineup ingestion cron job
    console.log('🕐 Setting up daily lineup ingestion schedule...');

    // Create the cron job to run every day at 4 AM ET (9 AM UTC)
    const cronResult = await supabase.rpc('cron_schedule', {
      job_name: 'daily-lineup-ingestion',
      schedule: '0 9 * * *', // 9 AM UTC = 4 AM ET
      command: `
        SELECT net.http_post(
          url := 'https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/ingest-lineups',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb,
          body := '{"force": false}'::jsonb
        );
      `
    });

    console.log('✅ Cron job scheduled successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily lineup ingestion scheduled for 4 AM ET',
      schedule: '0 9 * * * (9 AM UTC / 4 AM ET)',
      job_name: 'daily-lineup-ingestion'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to schedule lineup ingestion:', error);
    
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
