
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GameLineup {
  id: string;
  game_pk: number;
  team_id: number;
  player_id: number;
  player_name: string;
  batting_order: number | null;
  position_code: string | null;
  position: string;
  lineup_type: 'batting' | 'pitching';
  handedness: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export const useGameLineups = (gamePk: number) => {
  return useQuery({
    queryKey: ['game-lineups', gamePk],
    queryFn: async () => {
      console.log(`Fetching lineups for game ${gamePk}`);
      
      const { data, error } = await supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', gamePk)
        .order('team_id')
        .order('batting_order');

      if (error) {
        console.error('Error fetching game lineups:', error);
        throw error;
      }

      console.log(`Found ${data?.length || 0} lineup entries for game ${gamePk}`);

      // Transform the data to match the expected interface
      const transformedData: GameLineup[] = (data || []).map(lineup => ({
        id: lineup.id,
        game_pk: gamePk, // Use the provided gamePk since game_lineups uses game_id
        team_id: lineup.team_id,
        player_id: lineup.player_id,
        player_name: lineup.player_name || `Player ${lineup.player_id}`,
        batting_order: lineup.batting_order,
        position_code: lineup.position || null,
        position: lineup.position || 'Unknown',
        lineup_type: lineup.lineup_type as 'batting' | 'pitching',
        handedness: lineup.handedness || 'R',
        date: new Date().toISOString().split('T')[0], // Use current date as fallback
        created_at: lineup.created_at,
        updated_at: lineup.updated_at
      }));

      console.log(`Transformed lineup data:`, transformedData);
      return transformedData;
    },
    enabled: !!gamePk,
  });
};
