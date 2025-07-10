import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Venue coordinates for weather lookup
const VENUE_COORDINATES = {
  'Yankee Stadium': { lat: 40.8296, lon: -73.9262, city: 'New York' },
  'Fenway Park': { lat: 42.3467, lon: -71.0972, city: 'Boston' },
  'Oriole Park at Camden Yards': { lat: 39.2840, lon: -76.6217, city: 'Baltimore' },
  'Tropicana Field': { lat: 27.7682, lon: -82.6534, city: 'St. Petersburg' },
  'Progressive Field': { lat: 41.4962, lon: -81.6852, city: 'Cleveland' },
  'Comerica Park': { lat: 42.3391, lon: -83.0485, city: 'Detroit' },
  'Guaranteed Rate Field': { lat: 41.8300, lon: -87.6338, city: 'Chicago' },
  'Kauffman Stadium': { lat: 39.0517, lon: -94.4803, city: 'Kansas City' },
  'Target Field': { lat: 44.9817, lon: -93.2777, city: 'Minneapolis' },
  'Minute Maid Park': { lat: 29.7572, lon: -95.3553, city: 'Houston' },
  'Angel Stadium': { lat: 33.8003, lon: -117.8827, city: 'Anaheim' },
  'Oakland Coliseum': { lat: 37.7516, lon: -122.2008, city: 'Oakland' },
  'T-Mobile Park': { lat: 47.5914, lon: -122.3326, city: 'Seattle' },
  'Globe Life Field': { lat: 32.7473, lon: -97.0815, city: 'Arlington' },
  'Truist Park': { lat: 33.8906, lon: -84.4677, city: 'Atlanta' },
  'loanDepot park': { lat: 25.7781, lon: -80.2197, city: 'Miami' },
  'Citi Field': { lat: 40.7571, lon: -73.8458, city: 'New York' },
  'Nationals Park': { lat: 38.8730, lon: -77.0074, city: 'Washington' },
  'Citizens Bank Park': { lat: 39.9061, lon: -75.1665, city: 'Philadelphia' },
  'Great American Ball Park': { lat: 39.0974, lon: -84.5061, city: 'Cincinnati' },
  'American Family Field': { lat: 43.0280, lon: -87.9712, city: 'Milwaukee' },
  'Wrigley Field': { lat: 41.9484, lon: -87.6553, city: 'Chicago' },
  'PNC Park': { lat: 40.4469, lon: -80.0057, city: 'Pittsburgh' },
  'Busch Stadium': { lat: 38.6226, lon: -90.1928, city: 'St. Louis' },
  'Coors Field': { lat: 39.7559, lon: -104.9942, city: 'Denver' },
  'Chase Field': { lat: 33.4453, lon: -112.0667, city: 'Phoenix' },
  'Petco Park': { lat: 32.7073, lon: -117.1566, city: 'San Diego' },
  'Oracle Park': { lat: 37.7786, lon: -122.3893, city: 'San Francisco' },
  'Dodger Stadium': { lat: 34.0739, lon: -118.2400, city: 'Los Angeles' },
  'George M. Steinbrenner Field': { lat: 27.9947, lon: -82.5107, city: 'Tampa' }
};

interface WeatherAPIResponse {
  current?: {
    temp_f: number;
    condition: {
      text: string;
    };
    wind_mph: number;
    wind_dir: string;
    humidity: number;
    pressure_in: number;
    vis_miles: number;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      day: {
        avgtemp_f: number;
        condition: {
          text: string;
        };
        maxwind_mph: number;
        avghumidity: number;
      };
      hour: Array<{
        time: string;
        temp_f: number;
        condition: {
          text: string;
        };
        wind_mph: number;
        wind_dir: string;
        humidity: number;
        pressure_in: number;
        vis_miles: number;
      }>;
    }>;
  };
}

serve(async (req) => {
  console.log('=== WEATHER DATA INGESTION FUNCTION CALLED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // NOTE: This function requires a weather API key
  // For now, we'll insert reasonable default weather data
  // In production, you'd want to integrate with a weather service like:
  // - WeatherAPI.com (free tier available)
  // - OpenWeatherMap
  // - AccuWeather API

  try {
    console.log('Starting weather data ingestion for upcoming games');

    // Log job start
    const { data: jobRecord, error: jobError } = await supabase
      .from('data_ingestion_jobs')
      .insert({
        job_name: 'Weather Data Ingestion',
        job_type: 'weather_data',
        data_source: 'Default Weather Data (Production: Weather API)',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobError) throw jobError;
    const jobId = jobRecord.id;

    // Get upcoming games that need weather data
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('game_id, venue_name, game_date, game_time')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .lte('game_date', nextWeek.toISOString().split('T')[0])
      .eq('status', 'scheduled');

    if (gamesError) {
      throw new Error(`Failed to fetch games: ${gamesError.message}`);
    }

    console.log(`Found ${games?.length || 0} upcoming games needing weather data`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const game of games || []) {
      try {
        // Check if weather data already exists
        const { data: existingWeather } = await supabase
          .from('weather_data')
          .select('id')
          .eq('game_id', game.game_id)
          .maybeSingle();

        if (existingWeather) {
          console.log(`Weather data already exists for game ${game.game_id}`);
          continue;
        }

        // Get venue coordinates
        const venue = VENUE_COORDINATES[game.venue_name as keyof typeof VENUE_COORDINATES];
        
        // For now, insert reasonable default weather data
        // In production, this would call a real weather API
        const defaultWeatherData = {
          game_id: game.game_id,
          temperature_f: 72 + (Math.random() * 20 - 10), // 62-82°F range
          condition: ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'][Math.floor(Math.random() * 4)],
          wind_speed_mph: 5 + (Math.random() * 10), // 5-15 mph
          wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
          humidity_percent: 40 + Math.floor(Math.random() * 40), // 40-80%
          pressure_inches: 29.8 + (Math.random() * 0.4), // 29.8-30.2 inches
          visibility_miles: 8 + Math.floor(Math.random() * 3) // 8-10 miles
        };

        // If we have venue coordinates, we could call a weather API here:
        /*
        if (venue && weatherApiKey) {
          const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${venue.lat},${venue.lon}&days=7&aqi=no&alerts=no`;
          
          try {
            const weatherResponse = await fetch(weatherUrl);
            if (weatherResponse.ok) {
              const weatherData: WeatherAPIResponse = await weatherResponse.json();
              // Process real weather data...
            }
          } catch (weatherError) {
            console.warn(`Weather API failed for ${game.venue_name}, using defaults`);
          }
        }
        */

        console.log(`Inserting weather data for game ${game.game_id} at ${game.venue_name}:`, defaultWeatherData);

        const { error } = await supabase
          .from('weather_data')
          .insert(defaultWeatherData);

        if (error) {
          console.error(`Error inserting weather data for game ${game.game_id}:`, error);
          errors.push(`Game ${game.game_id}: ${error.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`Successfully processed weather data for game ${game.game_id}`);
        }

      } catch (error) {
        console.error(`Error processing weather for game ${game.game_id}:`, error);
        errors.push(`Game ${game.game_id}: ${error.message}`);
        errorCount++;
      }
    }

    // Update job completion
    await supabase
      .from('data_ingestion_jobs')
      .update({
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        records_processed: games?.length || 0,
        records_inserted: processedCount,
        errors_count: errorCount,
        error_details: errors.length > 0 ? { errors } : null
      })
      .eq('id', jobId);

    console.log(`Weather data ingestion complete: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      gamesProcessed: processedCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined,
      note: 'Currently using default weather data. Integrate with weather API for production use.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Weather data ingestion failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});