// supabase/functions/generate-predictions/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GENERATE PREDICTIONS V2 FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0]);

    if (gamesError) throw gamesError;

    for (const game of games || []) {
      const { data: lineups, error: lineupsError } = await supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', game.game_id);

      if (lineupsError || !lineups || lineups.length < 18) {
        console.warn(`Skipping game ${game.game_id}: Incomplete lineup data.`);
        continue;
      }

      try {
        const { data: simResult, error: simError } = await supabase.functions.invoke('monte-carlo-simulation', {
          body: { game_id: game.game_id, iterations: 10000 }
        });

        if (simError) throw simError;

        if (simResult.success) {
          const { simulation_stats, factors } = simResult;
          const prediction = {
            game_id: game.game_id,
            home_win_probability: simulation_stats.home_win_probability,
            away_win_probability: simulation_stats.away_win_probability,
            predicted_home_score: simulation_stats.predicted_home_score,
            predicted_away_score: simulation_stats.predicted_away_score,
            over_under_line: simulation_stats.over_under_line,
            over_probability: simulation_stats.over_probability,
            under_probability: simulation_stats.under_probability,
            confidence_score: simulation_stats.confidence_score,
            key_factors: { ...factors, prediction_method: 'monte_carlo' },
            prediction_date: new Date().toISOString(),
            last_updated: new Date().toISOString()
          };
          
          await supabase.from('game_predictions').upsert(prediction, { onConflict: 'game_id' });
          console.log(`✅ Prediction generated for game ${game.game_id}`);
        }
      } catch (error) {
        console.error(`Failed to generate prediction for game ${game.game_id}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Prediction generation complete.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (error) {
    console.error('❌ Prediction generation failed:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});