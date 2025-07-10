
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Player {
  id: number;
  player_id: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team_id?: number;
  batting_hand?: string;
  pitching_hand?: string;
  birth_date?: string;
  height_inches?: number;
  weight_pounds?: number;
  jersey_number?: number;
  active: boolean;
  team?: {
    id: number;
    name: string;
    abbreviation: string;
    league: string;
    division: string;
  };
}

export const usePlayers = (teamId?: number, position?: string) => {
  return useQuery({
    queryKey: ['players', teamId, position],
    queryFn: async () => {
      let query = supabase
        .from('players')
        .select(`
          *,
          team:teams(id, name, abbreviation, league, division)
        `)
        .eq('active', true);

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      if (position) {
        query = query.eq('position', position);
      }

      query = query.order('full_name');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching players:', error);
        throw error;
      }

      return data as Player[];
    },
  });
};

export const usePlayer = (playerId: number) => {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          team:teams(id, name, abbreviation, league, division)
        `)
        .eq('player_id', playerId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching player:', error);
        throw error;
      }

      return data as Player | null;
    },
  });
};
