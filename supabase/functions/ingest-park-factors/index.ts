import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static park factors data (since this changes rarely)
const PARK_FACTORS_2025 = {
  'Coors Field': { runs_factor: 1.20, hr_factor: 1.15, hits_factor: 1.08 },
  'Great American Ball Park': { runs_factor: 1.05, hr_factor: 1.10, hits_factor: 1.02 },
  'Yankee Stadium': { runs_factor: 1.03, hr_factor: 1.08, hits_factor: 1.01 },
  'Fenway Park': { runs_factor: 1.02, hr_factor: 1.05, hits_factor: 1.03 },
  'Minute Maid Park': { runs_factor: 1.01, hr_factor: 1.03, hits_factor: 1.00 },
  'Wrigley Field': { runs_factor: 1.00, hr_factor: 1.02, hits_factor: 1.01 },
  'Busch Stadium': { runs_factor: 0.99, hr_factor: 0.98, hits_factor: 1.00 },
  'Citi Field': { runs_factor: 0.98, hr_factor: 0.95, hits_factor: 0.99 },
  'Progressive Field': { runs_factor: 0.97, hr_factor: 0.95, hits_factor: 0.98 },
  'Oriole Park at Camden Yards': { runs_factor: 1.04, hr_factor: 1.07, hits_factor: 1.02 },
  'Nationals Park': { runs_factor: 0.99, hr_factor: 0.98, hits_factor: 1.00 },
  'loanDepot park': { runs_factor: 0.96, hr_factor: 0.93, hits_factor: 0.98 },
  'T-Mobile Park': { runs_factor: 0.95, hr_factor: 0.92, hits_factor: 0.97 },
  'George M. Steinbrenner Field': { runs_factor: 1.00, hr_factor: 1.00, hits_factor: 1.00 }, // Spring training venue
  'Rate Field': { runs_factor: 1.01, hr_factor: 1.02, hits_factor: 1.00 },
  'Target Field': { runs_factor: 0.98, hr_factor: 0.96, hits_factor: 0.99 },
  // Add more stadiums as needed
  'Angel Stadium': { runs_factor: 0.98, hr_factor: 0.96, hits_factor: 0.99 },
  'Oakland Coliseum': { runs_factor: 0.95, hr_factor: 0.92, hits_factor: 0.97 },
  'Globe Life Field': { runs_factor: 1.03, hr_factor: 1.05, hits_factor: 1.01 },
  'Tropicana Field': { runs_factor: 0.97, hr_factor: 0.94, hits_factor: 0.98 },
  'Kauffman Stadium': { runs_factor: 0.98, hr_factor: 0.95, hits_factor: 0.99 },
  'Comerica Park': { runs_factor: 0.96, hr_factor: 0.93, hits_factor: 0.98 },
  'Guaranteed Rate Field': { runs_factor: 1.01, hr_factor: 1.02, hits_factor: 1.00 },
  'American Family Field': { runs_factor: 1.00, hr_factor: 1.00, hits_factor: 1.00 },
  'Petco Park': { runs_factor: 0.94, hr_factor: 0.90, hits_factor: 0.96 },
  'Oracle Park': { runs_factor: 0.93, hr_factor: 0.88, hits_factor: 0.96 },
  'Dodger Stadium': { runs_factor: 0.97, hr_factor: 0.94, hits_factor: 0.98 },
  'Chase Field': { runs_factor: 1.02, hr_factor: 1.04, hits_factor: 1.01 },
  'Truist Park': { runs_factor: 1.00, hr_factor: 1.00, hits_factor: 1.00 },
  'PNC Park': { runs_factor: 0.98, hr_factor: 0.96, hits_factor: 0.99 }
};

serve(async (req) => {
  console.log('=== PARK FACTORS INGESTION FUNCTION CALLED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const currentSeason = new Date().getFullYear();
    console.log(`Starting park factors ingestion for ${currentSeason} season`);

    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'Park Factors Ingestion',
        job_type: 'park_factors',
        data_source: 'Static Data + MLB Stats API',
        status: 'running',
        started_at: new Date().toISOString(),
        season: currentSeason
      })
      .select('id')
      .single();

    if (jobError) throw jobError;
    const jobId = jobRecord.id;

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get all unique venue names from games table
    const { data: venues, error: venuesError } = await supabase
      .from('games')
      .select('venue_name')
      .not('venue_name', 'is', null);

    if (venuesError) {
      throw new Error(`Failed to fetch venues: ${venuesError.message}`);
    }

    const uniqueVenues = [...new Set(venues?.map(v => v.venue_name) || [])];
    console.log(`Found ${uniqueVenues.length} unique venues:`, uniqueVenues);

    // Process each venue
    for (const venueName of uniqueVenues) {
      if (!venueName) continue;

      try {
        // Get park factors for this venue (use defaults if not in our data)
        const factors = PARK_FACTORS_2025[venueName] || {
          runs_factor: 1.00,
          hr_factor: 1.00,
          hits_factor: 1.00
        };

        const parkFactorData = {
          venue_name: venueName,
          season: currentSeason,
          runs_factor: factors.runs_factor,
          hr_factor: factors.hr_factor,
          hits_factor: factors.hits_factor,
          walks_factor: 1.00, // Default
          strikeouts_factor: 1.00 // Default
        };

        console.log(`Upserting park factors for ${venueName}:`, parkFactorData);

        const { error } = await supabase
          .from('park_factors')
          .upsert(parkFactorData, {
            onConflict: 'venue_name,season',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Error upserting park factors for ${venueName}:`, error);
          errors.push(`${venueName}: ${error.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`Successfully processed park factors for ${venueName}`);
        }

      } catch (error) {
        console.error(`Error processing venue ${venueName}:`, error);
        errors.push(`${venueName}: ${error.message}`);
        errorCount++;
      }
    }

    // Update job completion
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        records_processed: uniqueVenues.length,
        records_inserted: processedCount,
        errors_count: errorCount,
        error_details: errors.length > 0 ? { errors } : null
      })
      .eq('id', jobId);

    console.log(`Park factors ingestion complete: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      season: currentSeason,
      venuesProcessed: processedCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Park factors ingestion failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});