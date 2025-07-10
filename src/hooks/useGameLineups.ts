import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GameLineup {
  id: string;
  game_id: number;
  team_id: number;
  lineup_type: 'batting' | 'pitching';
  batting_order?: number;
  position: string;
  player_id: number;
  player_name: string;
  handedness: string;
  is_starter: boolean;
}

export const useGameLineups = (gameId: number) => {
  return useQuery({
    queryKey: ['game-lineups', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', gameId)
        .order('team_id')
        .order('lineup_type')
        .order('batting_order');

      if (error) {
        console.error('Error fetching game lineups:', error);
        throw error;
      }

      return data as GameLineup[];
    },
    enabled: !!gameId,
  });
};

export const useTeamLineup = (gameId: number, teamId: number, lineupType: 'batting' | 'pitching') => {
  return useQuery({
    queryKey: ['team-lineup', gameId, teamId, lineupType],
    queryFn: async () => {
      let query = supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', gameId)
        .eq('team_id', teamId)
        .eq('lineup_type', lineupType);

      if (lineupType === 'batting') {
        query = query.order('batting_order');
      } else {
        query = query.eq('is_starter', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching team lineup:', error);
        throw error;
      }

      return data as GameLineup[];
    },
    enabled: !!gameId && !!teamId,
  });
};