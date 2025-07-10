
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BattingStats {
  id: number;
  player_id: number;
  season: number;
  team_id?: number;
  games_played: number;
  at_bats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  caught_stealing: number;
  hit_by_pitch: number;
  sacrifice_hits: number;
  sacrifice_flies: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  wrc_plus: number;
  babip: number;
  iso: number;
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

export const useBattingStats = (season?: number, teamId?: number) => {
  return useQuery({
    queryKey: ['batting-stats', season, teamId],
    queryFn: async () => {
      let query = supabase
        .from('batting_stats')
        .select(`
          *,
          player:players!batting_stats_player_id_fkey(player_id, full_name, position),
          team:teams(id, name, abbreviation)
        `);

      if (season) {
        query = query.eq('season', season);
      }

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      query = query.order('ops', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching batting stats:', error);
        throw error;
      }

      return data as BattingStats[];
    },
  });
};

export const usePlayerBattingStats = (playerId: number, season?: number) => {
  return useQuery({
    queryKey: ['batting-stats', playerId, season],
    queryFn: async () => {
      let query = supabase
        .from('batting_stats')
        .select(`
          *,
          player:players!batting_stats_player_id_fkey(player_id, full_name, position),
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
        console.error('Error fetching player batting stats:', error);
        throw error;
      }

      return data as BattingStats[];
    },
  });
};
