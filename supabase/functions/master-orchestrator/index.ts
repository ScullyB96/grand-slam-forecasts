import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestrationStep {
  name: string;
  function_name: string;
  required: boolean;
  timeout: number; // in milliseconds
}

const INGESTION_PIPELINE: OrchestrationStep[] = [
  { name: 'Schedule Ingestion', function_name: 'ingest-schedule', required: true, timeout: 60000 },
  { name: 'Team Stats', function_name: 'ingest-team-stats', required: true, timeout: 45000 },
  { name: 'Park Factors', function_name: 'ingest-park-factors', required: true, timeout: 30000 },
  { name: 'Weather Data', function_name: 'ingest-weather-data', required: false, timeout: 30000 },
  { name: 'Player Rosters', function_name: 'ingest-player-rosters', required: true, timeout: 60000 },
  { name: 'Batting Stats', function_name: 'ingest-player-batting-stats', required: true, timeout: 120000 },
  { name: 'Pitching Stats', function_name: 'ingest-player-pitching-stats', required: true, timeout: 120000 },
  { name: 'Statcast Data', function_name: 'ingest-statcast-data', required: true, timeout: 180000 },
];

serve(async (req) => {
  console.log('=== MASTER ORCHESTRATOR STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let jobId: number | null = null;

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { 
      target_date = new Date().toISOString().split('T')[0],
      force_refresh = false,
      skip_steps = []
    } = requestBody;

    console.log(`🎯 Starting orchestration for date: ${target_date}`);

    // Create orchestration job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'master-orchestrator',
        job_type: 'orchestration',
        status: 'running',
        started_at: new Date().toISOString(),
        data_source: 'mlb_api'
      })
      .select('id')
      .single();

    if (jobError) {
      throw new Error('Failed to create orchestration job: ' + jobError.message);
    }

    jobId = jobRecord.id;
    console.log(`📋 Created orchestration job ${jobId}`);

    const results: any[] = [];
    let totalSteps = INGESTION_PIPELINE.length;
    let completedSteps = 0;
    let failedSteps = 0;

    // Execute pipeline steps
    for (const step of INGESTION_PIPELINE) {
      if (skip_steps.includes(step.function_name)) {
        console.log(`⏭️  Skipping ${step.name}`);
        continue;
      }

      console.log(`🔄 Executing: ${step.name}`);
      
      try {
        const startTime = Date.now();
        
        // Call the function with timeout
        const response = await Promise.race([
          supabase.functions.invoke(step.function_name, {
            body: { 
              target_date,
              force_refresh,
              orchestrated: true 
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), step.timeout)
          )
        ]);

        const duration = Date.now() - startTime;

        if (response.error) {
          throw new Error(response.error.message || 'Function execution failed');
        }

        const result = {
          step: step.name,
          function_name: step.function_name,
          status: 'success',
          duration: duration,
          data: response.data,
          required: step.required
        };

        results.push(result);
        completedSteps++;

        console.log(`✅ ${step.name} completed in ${duration}ms`);

      } catch (error) {
        const result = {
          step: step.name,
          function_name: step.function_name,
          status: 'failed',
          error: error.message,
          required: step.required
        };

        results.push(result);
        failedSteps++;

        console.error(`❌ ${step.name} failed: ${error.message}`);

        // If this is a required step, decide whether to continue or abort
        if (step.required) {
          console.warn(`⚠️  Required step failed: ${step.name}`);
          // Continue with other steps for now, but mark as degraded
        }
      }
    }

    // Determine overall status
    const criticalFailures = results.filter(r => r.status === 'failed' && r.required).length;
    let overallStatus = 'completed';
    
    if (criticalFailures > 0) {
      overallStatus = 'completed_with_errors';
    } else if (failedSteps > 0) {
      overallStatus = 'completed_with_warnings';
    }

    // Update job status
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: overallStatus,
        completed_at: new Date().toISOString(),
        records_processed: totalSteps,
        records_inserted: completedSteps,
        errors_count: failedSteps,
        error_details: {
          results: results,
          summary: {
            total_steps: totalSteps,
            completed: completedSteps,
            failed: failedSteps,
            critical_failures: criticalFailures
          }
        }
      })
      .eq('id', jobId);

    console.log(`🎯 Orchestration completed: ${completedSteps}/${totalSteps} steps successful`);

    // Optional: Trigger feature engineering for today's games
    if (overallStatus === 'completed' || overallStatus === 'completed_with_warnings') {
      try {
        console.log('🔧 Triggering feature engineering...');
        await supabase.functions.invoke('feature-engineering', {
          body: { 
            target_date,
            force_refresh: false
          }
        });
        console.log('✅ Feature engineering triggered');
      } catch (feError) {
        console.warn('⚠️  Feature engineering failed to trigger:', feError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      target_date: target_date,
      status: overallStatus,
      summary: {
        total_steps: totalSteps,
        completed: completedSteps,
        failed: failedSteps,
        critical_failures: criticalFailures
      },
      results: results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Master orchestration failed:', error);
    
    // Update job as failed if we have a job ID
    if (jobId) {
      try {
        await supabase
          .from('data_ingestion_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { error: error.message }
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('Failed to update job as failed:', updateError);
      }
    }
    
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