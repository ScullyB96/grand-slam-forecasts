// supabase/functions/ingest-lineups/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGameLineups, extractLineupsFromGameFeed, createTeamIdMapping } from '../shared/mlb-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== LINEUP INGESTION V2 FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { date: targetDate = new Date().toISOString().split('T')[0], force = false } = await req.json();

    console.log(`🎯 Starting lineup ingestion for ${targetDate}, force: ${force}`);

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_id, name, abbreviation');

    if (teamsError) throw new Error('Failed to fetch teams: ' + teamsError.message);

    const teamIdMapping = createTeamIdMapping(teams || []);

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('game_id, home_team_id, away_team_id')
      .eq('game_date', targetDate)
      .eq('status', 'scheduled');

    if (gamesError) throw new Error(`Failed to fetch games for ${targetDate}: ${gamesError.message}`);

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ success: true, message: `No games for ${targetDate}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    for (const game of games) {
      if (force) {
        await supabase.from('game_lineups').delete().eq('game_id', game.game_id);
      } else {
        const { data: existing } = await supabase.from('game_lineups').select('id').eq('game_id', game.game_id).limit(1);
        if (existing && existing.length > 0) {
          console.log(`Skipping game ${game.game_id}, lineups already exist.`);
          continue;
        }
      }
      
      try {
        const gameData = await getGameLineups(game.game_id);
        const lineups = extractLineupsFromGameFeed(gameData, teamIdMapping);

        if (lineups.length > 0) {
          const { error: insertError } = await supabase.from('game_lineups').insert(lineups);
          if (insertError) throw insertError;
          console.log(`✅ Inserted ${lineups.length} lineup entries for game ${game.game_id}`);
        } else {
          console.warn(`No lineups extracted for game ${game.game_id}.`);
        }
      } catch (error) {
        console.error(`Failed to process game ${game.game_id}: ${error.message}`);
      }
    }