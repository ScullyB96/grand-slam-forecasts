import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BattingSplit {
  id: number;
  player_id: number;
  season: number;
  team_id?: number;
  vs_handedness: 'L' | 'R';
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
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  wrc_plus: number;
}

export interface PitchingSplit {
  id: number;
  player_id: number;
  season: number;
  team_id?: number;
  split_type: 'home' | 'away' | 'vs_L' | 'vs_R';
  games: number;
  games_started: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  home_runs_allowed: number;
  walks: number;
  strikeouts: number;
  era: number;
  whip: number;
  k_9: number;
  bb_9: number;
  hr_9: number;
}

export const usePlayerBattingSplits = (playerId: number, season: number) => {
  return useQuery({
    queryKey: ['batting-splits', playerId, season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batting_splits')
        .select('*')
        .eq('player_id', playerId)
        .eq('season', season);

      if (error) {
        console.error('Error fetching batting splits:', error);
        throw error;
      }

      return data as BattingSplit[];
    },
    enabled: !!playerId && !!season,
  });
};

export const usePlayerPitchingSplits = (playerId: number, season: number) => {
  return useQuery({
    queryKey: ['pitching-splits', playerId, season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pitching_splits')
        .select('*')
        .eq('player_id', playerId)
        .eq('season', season);

      if (error) {
        console.error('Error fetching pitching splits:', error);
        throw error;
      }

      return data as PitchingSplit[];
    },
    enabled: !!playerId && !!season,
  });
};