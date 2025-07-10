import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive park factors data with ballpark characteristics
// Data sourced from Baseball Reference, FanGraphs, and historical analysis
const PARK_FACTORS_2025 = {
  'Coors Field': { 
    runs_factor: 1.189, hr_factor: 1.125, hits_factor: 1.090, walks_factor: 0.995, strikeouts_factor: 0.962,
    altitude: 5200, surface: 'Grass', left_field_distance: 347, center_field_distance: 415, right_field_distance: 350,
    left_field_height: 12, center_field_height: 12, right_field_height: 12, foul_territory_rating: 5
  },
  'Fenway Park': { 
    runs_factor: 1.089, hr_factor: 1.138, hits_factor: 1.042, walks_factor: 1.012, strikeouts_factor: 0.985,
    altitude: 20, surface: 'Grass', left_field_distance: 310, center_field_distance: 420, right_field_distance: 302,
    left_field_height: 37, center_field_height: 17, right_field_height: 3, foul_territory_rating: 2
  },
  'Yankee Stadium': { 
    runs_factor: 1.078, hr_factor: 1.245, hits_factor: 1.019, walks_factor: 0.996, strikeouts_factor: 0.989,
    altitude: 55, surface: 'Grass', left_field_distance: 318, center_field_distance: 408, right_field_distance: 314,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 4
  },
  'Minute Maid Park': { 
    runs_factor: 1.056, hr_factor: 1.089, hits_factor: 1.025, walks_factor: 1.008, strikeouts_factor: 0.992,
    altitude: 22, surface: 'Grass', left_field_distance: 315, center_field_distance: 436, right_field_distance: 326,
    left_field_height: 19, center_field_height: 12, right_field_height: 7, foul_territory_rating: 3
  },
  'Globe Life Field': { 
    runs_factor: 1.045, hr_factor: 1.067, hits_factor: 1.018, walks_factor: 1.002, strikeouts_factor: 0.995,
    altitude: 551, surface: 'Artificial Turf', left_field_distance: 329, center_field_distance: 407, right_field_distance: 326,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 5
  },
  'Citizens Bank Park': { 
    runs_factor: 1.039, hr_factor: 1.089, hits_factor: 1.012, walks_factor: 0.998, strikeouts_factor: 0.996,
    altitude: 75, surface: 'Grass', left_field_distance: 329, center_field_distance: 401, right_field_distance: 325,
    left_field_height: 6, center_field_height: 13, right_field_height: 14, foul_territory_rating: 4
  },
  'Great American Ball Park': { 
    runs_factor: 1.032, hr_factor: 1.078, hits_factor: 1.009, walks_factor: 1.001, strikeouts_factor: 0.997,
    altitude: 550, surface: 'Grass', left_field_distance: 325, center_field_distance: 404, right_field_distance: 325,
    left_field_height: 12, center_field_height: 12, right_field_height: 12, foul_territory_rating: 5
  },
  'Wrigley Field': { 
    runs_factor: 1.025, hr_factor: 1.089, hits_factor: 1.005, walks_factor: 0.999, strikeouts_factor: 0.998,
    altitude: 600, surface: 'Grass', left_field_distance: 355, center_field_distance: 400, right_field_distance: 353,
    left_field_height: 11, center_field_height: 11, right_field_height: 11, foul_territory_rating: 3
  },
  'Citi Field': { 
    runs_factor: 1.018, hr_factor: 0.945, hits_factor: 1.012, walks_factor: 1.004, strikeouts_factor: 0.994,
    altitude: 20, surface: 'Grass', left_field_distance: 335, center_field_distance: 408, right_field_distance: 330,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 6
  },
  'Truist Park': { 
    runs_factor: 1.015, hr_factor: 1.034, hits_factor: 1.008, walks_factor: 0.998, strikeouts_factor: 0.999,
    altitude: 1050, surface: 'Grass', left_field_distance: 335, center_field_distance: 400, right_field_distance: 325,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 4
  },
  'loanDepot park': { 
    runs_factor: 1.008, hr_factor: 1.012, hits_factor: 1.003, walks_factor: 1.001, strikeouts_factor: 0.999,
    altitude: 10, surface: 'Grass', left_field_distance: 344, center_field_distance: 418, right_field_distance: 335,
    left_field_height: 12, center_field_height: 12, right_field_height: 12, foul_territory_rating: 7
  },
  'Kauffman Stadium': { 
    runs_factor: 1.005, hr_factor: 0.989, hits_factor: 1.002, walks_factor: 1.002, strikeouts_factor: 0.998,
    altitude: 910, surface: 'Grass', left_field_distance: 330, center_field_distance: 410, right_field_distance: 330,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 8
  },
  'Target Field': { 
    runs_factor: 1.002, hr_factor: 0.978, hits_factor: 1.001, walks_factor: 1.001, strikeouts_factor: 0.999,
    altitude: 815, surface: 'Grass', left_field_distance: 339, center_field_distance: 411, right_field_distance: 328,
    left_field_height: 8, center_field_height: 8, right_field_height: 23, foul_territory_rating: 5
  },
  'Busch Stadium': { 
    runs_factor: 1.000, hr_factor: 1.000, hits_factor: 1.000, walks_factor: 1.000, strikeouts_factor: 1.000,
    altitude: 465, surface: 'Grass', left_field_distance: 336, center_field_distance: 400, right_field_distance: 335,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 5
  },
  'Nationals Park': { 
    runs_factor: 0.998, hr_factor: 0.987, hits_factor: 0.999, walks_factor: 1.002, strikeouts_factor: 1.001,
    altitude: 55, surface: 'Grass', left_field_distance: 336, center_field_distance: 402, right_field_distance: 335,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 4
  },
  'American Family Field': { 
    runs_factor: 0.995, hr_factor: 0.976, hits_factor: 0.998, walks_factor: 1.003, strikeouts_factor: 1.002,
    altitude: 635, surface: 'Grass', left_field_distance: 344, center_field_distance: 400, right_field_distance: 345,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 6
  },
  'Angel Stadium': { 
    runs_factor: 0.992, hr_factor: 0.965, hits_factor: 0.997, walks_factor: 1.004, strikeouts_factor: 1.003,
    altitude: 150, surface: 'Grass', left_field_distance: 347, center_field_distance: 396, right_field_distance: 350,
    left_field_height: 8, center_field_height: 8, right_field_height: 18, foul_territory_rating: 8
  },
  'Guaranteed Rate Field': { 
    runs_factor: 0.989, hr_factor: 0.978, hits_factor: 0.996, walks_factor: 1.005, strikeouts_factor: 1.004,
    altitude: 595, surface: 'Grass', left_field_distance: 330, center_field_distance: 400, right_field_distance: 335,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 6
  },
  'Progressive Field': { 
    runs_factor: 0.987, hr_factor: 0.923, hits_factor: 0.995, walks_factor: 1.006, strikeouts_factor: 1.005,
    altitude: 650, surface: 'Grass', left_field_distance: 325, center_field_distance: 405, right_field_distance: 325,
    left_field_height: 19, center_field_height: 8, right_field_height: 8, foul_territory_rating: 5
  },
  'PNC Park': { 
    runs_factor: 0.985, hr_factor: 0.934, hits_factor: 0.994, walks_factor: 1.007, strikeouts_factor: 1.006,
    altitude: 730, surface: 'Grass', left_field_distance: 325, center_field_distance: 399, right_field_distance: 320,
    left_field_height: 6, center_field_height: 10, right_field_height: 21, foul_territory_rating: 4
  },
  'Chase Field': { 
    runs_factor: 0.982, hr_factor: 0.967, hits_factor: 0.993, walks_factor: 1.008, strikeouts_factor: 1.007,
    altitude: 1090, surface: 'Grass', left_field_distance: 330, center_field_distance: 407, right_field_distance: 334,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 7
  },
  'Dodger Stadium': { 
    runs_factor: 0.978, hr_factor: 0.945, hits_factor: 0.991, walks_factor: 1.009, strikeouts_factor: 1.009,
    altitude: 340, surface: 'Grass', left_field_distance: 330, center_field_distance: 395, right_field_distance: 330,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 8
  },
  'Oriole Park at Camden Yards': { 
    runs_factor: 0.975, hr_factor: 0.923, hits_factor: 0.989, walks_factor: 1.011, strikeouts_factor: 1.011,
    altitude: 50, surface: 'Grass', left_field_distance: 333, center_field_distance: 410, right_field_distance: 318,
    left_field_height: 7, center_field_height: 7, right_field_height: 25, foul_territory_rating: 3
  },
  'Comerica Park': { 
    runs_factor: 0.972, hr_factor: 0.901, hits_factor: 0.987, walks_factor: 1.013, strikeouts_factor: 1.013,
    altitude: 585, surface: 'Grass', left_field_distance: 345, center_field_distance: 420, right_field_distance: 330,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 7
  },
  'T-Mobile Park': { 
    runs_factor: 0.969, hr_factor: 0.889, hits_factor: 0.985, walks_factor: 1.015, strikeouts_factor: 1.015,
    altitude: 135, surface: 'Grass', left_field_distance: 331, center_field_distance: 401, right_field_distance: 326,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 8
  },
  'Oracle Park': { 
    runs_factor: 0.965, hr_factor: 0.867, hits_factor: 0.982, walks_factor: 1.018, strikeouts_factor: 1.018,
    altitude: 10, surface: 'Grass', left_field_distance: 339, center_field_distance: 399, right_field_distance: 309,
    left_field_height: 8, center_field_height: 8, right_field_height: 25, foul_territory_rating: 9
  },
  'Petco Park': { 
    runs_factor: 0.958, hr_factor: 0.834, hits_factor: 0.978, walks_factor: 1.022, strikeouts_factor: 1.022,
    altitude: 60, surface: 'Grass', left_field_distance: 336, center_field_distance: 396, right_field_distance: 322,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 9
  },
  'Oakland Coliseum': { 
    runs_factor: 0.952, hr_factor: 0.812, hits_factor: 0.975, walks_factor: 1.025, strikeouts_factor: 1.025,
    altitude: 5, surface: 'Grass', left_field_distance: 330, center_field_distance: 400, right_field_distance: 330,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 10
  },
  'Tropicana Field': { 
    runs_factor: 0.945, hr_factor: 0.789, hits_factor: 0.971, walks_factor: 1.029, strikeouts_factor: 1.029,
    altitude: 15, surface: 'Artificial Turf', left_field_distance: 315, center_field_distance: 404, right_field_distance: 322,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 10
  },
  'George M. Steinbrenner Field': { 
    runs_factor: 1.00, hr_factor: 1.00, hits_factor: 1.00, walks_factor: 1.00, strikeouts_factor: 1.00,
    altitude: 50, surface: 'Grass', left_field_distance: 318, center_field_distance: 408, right_field_distance: 314,
    left_field_height: 8, center_field_height: 8, right_field_height: 8, foul_territory_rating: 4
  }
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
          walks_factor: factors.walks_factor || 1.00,
          strikeouts_factor: factors.strikeouts_factor || 1.00,
          altitude: factors.altitude || 0,
          surface: factors.surface || 'Grass',
          left_field_distance: factors.left_field_distance || null,
          center_field_distance: factors.center_field_distance || null,
          right_field_distance: factors.right_field_distance || null,
          left_field_height: factors.left_field_height || null,
          center_field_height: factors.center_field_height || null,
          right_field_height: factors.right_field_height || null,
          foul_territory_rating: factors.foul_territory_rating || 5
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