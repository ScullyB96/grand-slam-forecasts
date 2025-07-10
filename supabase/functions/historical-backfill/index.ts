import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  startDate: string;
  endDate: string;
  includeLineups?: boolean;
  includePredictions?: boolean;
  includePlayerStats?: boolean;
  force?: boolean; // Force re-ingestion even if data exists
}

serve(async (req) => {
  console.log('=== HISTORICAL BACKFILL FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody: BackfillRequest = await req.json();
    const { startDate, endDate, includeLineups = true, includePredictions = false, includePlayerStats = false, force = false } = requestBody;

    console.log('Backfill request:', { startDate, endDate, includeLineups, includePredictions, includePlayerStats, force });

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      throw new Error('Date range cannot exceed 30 days');
    }

    console.log(`Processing ${daysDiff + 1} days from ${startDate} to ${endDate}`);

    // Create main backfill job
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'historical-backfill',
        job_type: 'historical_backfill',
        status: 'running',
        started_at: new Date().toISOString(),
        season: start.getFullYear(),
        data_source: 'MLB Stats API'
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      throw jobError;
    }

    const jobId = jobRecord.id;
    console.log('Created backfill job with ID:', jobId);

    const results = {
      totalDays: daysDiff + 1,
      processedDays: 0,
      scheduleSuccess: 0,
      lineupSuccess: 0,
      predictionSuccess: 0,
      playerStatsSuccess: 0,
      errors: [] as string[]
    };

    // Process each date in the range
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      console.log(`\n=== Processing date: ${dateStr} ===`);

      try {
        // 1. Ingest schedule for this date
        console.log(`1. Ingesting schedule for ${dateStr}`);
        const scheduleResult = await callEdgeFunction(
          'ingest-schedule',
          { date: dateStr, force }
        );
        
        if (scheduleResult.success) {
          results.scheduleSuccess++;
          console.log(`✅ Schedule ingested: ${scheduleResult.gamesProcessed} games`);
        } else {
          results.errors.push(`Schedule ${dateStr}: ${scheduleResult.error}`);
          console.log(`❌ Schedule failed: ${scheduleResult.error}`);
        }

        // 2. Ingest lineups if requested and games exist
        if (includeLineups && scheduleResult.success && scheduleResult.gamesProcessed > 0) {
          console.log(`2. Ingesting lineups for ${dateStr}`);
          
          // Update lineup function to use specific date
          const lineupResult = await callEdgeFunction(
            'ingest-lineups',
            { date: dateStr, force }
          );
          
          if (lineupResult.success) {
            results.lineupSuccess++;
            console.log(`✅ Lineups ingested: ${lineupResult.processed} players`);
          } else {
            results.errors.push(`Lineups ${dateStr}: ${lineupResult.error}`);
            console.log(`❌ Lineups failed: ${lineupResult.error}`);
          }
        }

        // 3. Generate predictions if requested
        if (includePredictions && scheduleResult.success && scheduleResult.gamesProcessed > 0) {
          console.log(`3. Generating predictions for ${dateStr}`);
          
          const predictionResult = await callEdgeFunction(
            'generate-predictions',
            { date: dateStr, force }
          );
          
          if (predictionResult.success) {
            results.predictionSuccess++;
            console.log(`✅ Predictions generated`);
          } else {
            results.errors.push(`Predictions ${dateStr}: ${predictionResult.error}`);
            console.log(`❌ Predictions failed: ${predictionResult.error}`);
          }
        }

        // 4. Ingest player stats if requested (run once, not per date)
        if (includePlayerStats && currentDate.getTime() === start.getTime()) {
          console.log(`4. Ingesting player statistics for season ${start.getFullYear()}`);
          
          try {
            // Ingest player rosters
            console.log('4a. Ingesting player rosters...');
            const rosterResult = await callEdgeFunction(
              'ingest-player-rosters',
              { season: start.getFullYear(), force }
            );
            
            if (rosterResult.success) {
              console.log(`✅ Player rosters ingested: ${rosterResult.playersInserted} new, ${rosterResult.playersUpdated} updated`);
            } else {
              results.errors.push(`Player rosters: ${rosterResult.error}`);
              console.log(`❌ Player rosters failed: ${rosterResult.error}`);
            }

            // Ingest batting stats
            console.log('4b. Ingesting batting statistics...');
            const battingResult = await callEdgeFunction(
              'ingest-player-batting-stats',
              { season: start.getFullYear(), force }
            );
            
            if (battingResult.success) {
              console.log(`✅ Batting stats ingested: ${battingResult.statsInserted} new, ${battingResult.statsUpdated} updated`);
            } else {
              results.errors.push(`Batting stats: ${battingResult.error}`);
              console.log(`❌ Batting stats failed: ${battingResult.error}`);
            }

            // Ingest pitching stats
            console.log('4c. Ingesting pitching statistics...');
            const pitchingResult = await callEdgeFunction(
              'ingest-player-pitching-stats',
              { season: start.getFullYear(), force }
            );
            
            if (pitchingResult.success) {
              console.log(`✅ Pitching stats ingested: ${pitchingResult.statsInserted} new, ${pitchingResult.statsUpdated} updated`);
              results.playerStatsSuccess++;
            } else {
              results.errors.push(`Pitching stats: ${pitchingResult.error}`);
              console.log(`❌ Pitching stats failed: ${pitchingResult.error}`);
            }

          } catch (error) {
            console.error(`Error ingesting player stats:`, error);
            results.errors.push(`Player stats: ${error.message}`);
          }
        }

        results.processedDays++;
        
      } catch (error) {
        console.error(`Error processing ${dateStr}:`, error);
        results.errors.push(`${dateStr}: ${error.message}`);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Update job completion
    const success = results.errors.length === 0;
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: success ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString(),
        records_processed: results.processedDays,
        errors_count: results.errors.length,
        error_details: results.errors.length > 0 ? { errors: results.errors } : null
      })
      .eq('id', jobId);

    console.log('=== BACKFILL COMPLETED ===');
    console.log('Results:', results);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      ...results,
      message: `Processed ${results.processedDays}/${results.totalDays} days`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    
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

async function callEdgeFunction(functionName: string, params: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  try {
    const url = `${supabaseUrl}/functions/v1/${functionName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceKey
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error(`${functionName} error:`, result);
      return { success: false, error: result.error || `HTTP ${response.status}` };
    }

    return { success: true, ...result };
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    return { success: false, error: error.message };
  }
}