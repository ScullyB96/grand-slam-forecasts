
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Lineup {
  id: string;
  game_pk: number;
  team_id: number;
  player_id: number;
  batting_order: number | null;
  position_code: string | null;
  player_name: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export const useLineups = (gamePk?: number, teamId?: number) => {
  return useQuery({
    queryKey: ['lineups', gamePk, teamId],
    queryFn: async () => {
      let query = supabase
        .from('lineups')
        .select('*')
        .order('batting_order', { ascending: true });

      if (gamePk) {
        query = query.eq('game_pk', gamePk);
      }

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching lineups:', error);
        throw error;
      }

      return data as Lineup[];
    },
    enabled: !!gamePk || !!teamId,
  });
};

export const useGameLineups = (gamePk: number) => {
  return useQuery({
    queryKey: ['game-lineups', gamePk],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lineups')
        .select('*')
        .eq('game_pk', gamePk)
        .order('team_id')
        .order('batting_order');

      if (error) {
        console.error('Error fetching game lineups:', error);
        throw error;
      }

      return data as Lineup[];
    },
    enabled: !!gamePk,
  });
};
