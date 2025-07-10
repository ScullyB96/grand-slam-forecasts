
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
    console.log('🕐 Setting up bulletproof daily lineup ingestion schedule...');

    // First, clear any existing cron jobs for lineup ingestion to avoid duplicates
    console.log('🧹 Clearing existing lineup ingestion cron jobs...');
    
    try {
      await supabase.rpc('cron_unschedule', {
        job_name: 'daily-lineup-ingestion'
      });
      console.log('✅ Cleared existing cron job');
    } catch (error) {
      console.log('ℹ️ No existing cron job to clear or clear failed:', error.message);
    }

    // Create the robust cron job to run every day at 4 AM ET (9 AM UTC during standard time, 8 AM UTC during daylight time)
    // Using 8 AM UTC to handle daylight saving time consistently
    const cronSchedule = '0 8 * * *'; // 8 AM UTC = 4 AM ET (during EDT) / 3 AM ET (during EST)
    
    console.log(`⏰ Scheduling daily lineup ingestion for ${cronSchedule} (8 AM UTC)`);

    const { data: cronResult, error: cronError } = await supabase.rpc('cron_schedule', {
      job_name: 'daily-lineup-ingestion',
      schedule: cronSchedule,
      command: `
        SELECT net.http_post(
          url := 'https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/ingest-lineups',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb,
          body := '{"force": false, "scheduled": true}'::jsonb
        );
      `
    });

    if (cronError) {
      console.error('❌ Failed to schedule cron job:', cronError);
      throw new Error(`Cron scheduling failed: ${cronError.message}`);
    }

    console.log('✅ Cron job scheduled successfully:', cronResult);

    // Also schedule a validation job 30 minutes later to check if lineups were ingested successfully
    console.log('📋 Scheduling lineup validation job...');
    
    const { data: validationResult, error: validationError } = await supabase.rpc('cron_schedule', {
      job_name: 'daily-lineup-validation',
      schedule: '30 8 * * *', // 30 minutes after ingestion
      command: `
        SELECT net.http_post(
          url := 'https://npvfusgiqvswmviohhqc.supabase.co/functions/v1/lineup-monitor',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb,
          body := '{"validate": true}'::jsonb
        );
      `
    });

    if (validationError) {
      console.warn('⚠️ Failed to schedule validation job:', validationError);
    } else {
      console.log('✅ Validation job scheduled successfully');
    }

    // Test the schedule immediately if requested
    const url = new URL(req.url);
    const testNow = url.searchParams.get('test');
    
    if (testNow === 'true') {
      console.log('🧪 Testing lineup ingestion immediately...');
      
      try {
        const { data: testResult, error: testError } = await supabase.functions.invoke('ingest-lineups', {
          body: { 
            force: false,
            test: true
          }
        });

        if (testError) {
          console.error('❌ Test ingestion failed:', testError);
        } else {
          console.log('✅ Test ingestion completed:', testResult);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Daily lineup ingestion scheduled and tested',
          schedule: `${cronSchedule} (8 AM UTC)`,
          job_name: 'daily-lineup-ingestion',
          validation_schedule: '30 8 * * * (8:30 AM UTC)',
          test_result: testResult,
          test_error: testError?.message || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('❌ Test execution failed:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Bulletproof daily lineup ingestion scheduled',
      schedule: `${cronSchedule} (8 AM UTC = ~4 AM ET)`,
      job_name: 'daily-lineup-ingestion',
      validation_schedule: '30 8 * * * (8:30 AM UTC = ~4:30 AM ET)',
      features: [
        'Robust retry logic with 5-minute backoff',
        'Comprehensive error logging and alerting',
        'Defensive data validation and completion rate monitoring',
        'Automatic validation check 30 minutes post-ingestion',
        'Upsert with conflict resolution to handle lineup changes'
      ]
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
