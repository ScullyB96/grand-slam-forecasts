
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PitchingStats {
  id: number;
  player_id: number;
  season: number;
  team_id?: number;
  games: number;
  games_started: number;
  complete_games: number;
  shutouts: number;
  saves: number;
  save_opportunities: number;
  holds: number;
  blown_saves: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  home_runs_allowed: number;
  walks: number;
  intentional_walks: number;
  strikeouts: number;
  hit_batters: number;
  wild_pitches: number;
  era: number;
  whip: number;
  k_9: number;
  bb_9: number;
  hr_9: number;
  fip: number;
  xfip: number;
  babip: number;
  strand_rate: number;
  player?: {
    player_id: number;
    full_name: string;
    position?: string;
  };
  team?: {
    id: number;
    name: string;
    abbreviation: string;
  };
}

export const usePitchingStats = (season?: number, teamId?: number) => {
  return useQuery({
    queryKey: ['pitching-stats', season, teamId],
    queryFn: async () => {
      let query = supabase
        .from('pitching_stats')
        .select(`
          *,
          player:players!pitching_stats_player_id_fkey(player_id, full_name, position),
          team:teams(id, name, abbreviation)
        `);

      if (season) {
        query = query.eq('season', season);
      }

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      query = query.order('era', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching pitching stats:', error);
        throw error;
      }

      return data as PitchingStats[];
    },
  });
};

export const usePlayerPitchingStats = (playerId: number, season?: number) => {
  return useQuery({
    queryKey: ['pitching-stats', playerId, season],
    queryFn: async () => {
      let query = supabase
        .from('pitching_stats')
        .select(`
          *,
          player:players!pitching_stats_player_id_fkey(player_id, full_name, position),
          team:teams(id, name, abbreviation)
        `)
        .eq('player_id', playerId);

      if (season) {
        query = query.eq('season', season);
      } else {
        query = query.order('season', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching player pitching stats:', error);
        throw error;
      }

      return data as PitchingStats[];
    },
  });
};
