
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GameLineup {
  id: string;
  game_id: number;
  team_id: number;
  player_id: number;
  player_name: string;
  batting_order: number | null;
  position: string;
  lineup_type: 'batting' | 'pitching';
  handedness: string;
  is_starter: boolean;
  created_at: string;
  updated_at: string;
}

export const useGameLineups = (gameId: number) => {
  return useQuery({
    queryKey: ['game-lineups', gameId],
    queryFn: async () => {
      console.log(`Fetching lineups for game ${gameId}`);
      
      const { data, error } = await supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', gameId)
        .order('team_id')
        .order('batting_order');

      if (error) {
        console.error('Error fetching game lineups:', error);
        throw error;
      }

      console.log(`Found ${data?.length || 0} lineup entries for game ${gameId}`);

      // Transform the data to match the expected interface
      const transformedData: GameLineup[] = (data || []).map(lineup => ({
        id: lineup.id,
        game_id: lineup.game_id,
        team_id: lineup.team_id,
        player_id: lineup.player_id,
        player_name: lineup.player_name || `Player ${lineup.player_id}`,
        batting_order: lineup.batting_order,
        position: lineup.position || 'Unknown',
        lineup_type: lineup.lineup_type as 'batting' | 'pitching',
        handedness: lineup.handedness || 'R',
        is_starter: lineup.is_starter ?? true,
        created_at: lineup.created_at,
        updated_at: lineup.updated_at
      }));

      console.log(`Transformed lineup data:`, transformedData);
      return transformedData;
    },
    enabled: !!gameId,
  });
};
