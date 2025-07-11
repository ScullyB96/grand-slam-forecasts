import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatcastMetrics {
  player_id: number;
  season: number;
  team_id?: number;
  
  // Batting metrics
  avg_exit_velocity?: number;
  max_exit_velocity?: number;
  avg_launch_angle?: number;
  barrel_pct?: number;
  hard_hit_pct?: number;
  xba?: number;
  xslg?: number;
  xwoba?: number;
  xobp?: number;
  xops?: number;
  sprint_speed?: number;
  sweet_spot_pct?: number;
  
  // Pitching metrics
  avg_fastball_velocity?: number;
  max_fastball_velocity?: number;
  avg_spin_rate?: number;
  whiff_pct?: number;
  chase_pct?: number;
  extension?: number;
  vertical_break?: number;
  horizontal_break?: number;
  
  // Fielding metrics
  outs_above_average?: number;
}

export const useStatcastData = (playerIds?: number[], season: number = 2025) => {
  return useQuery({
    queryKey: ['statcast-data', playerIds, season],
    queryFn: async () => {
      let query = supabase
        .from('player_statcast')
        .select('*')
        .eq('season', season);

      if (playerIds && playerIds.length > 0) {
        query = query.in('player_id', playerIds);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as StatcastMetrics[];
    },
    enabled: true
  });
};

export const usePlayerStatcast = (playerId: number, season: number = 2025) => {
  return useQuery({
    queryKey: ['player-statcast', playerId, season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_statcast')
        .select('*')
        .eq('player_id', playerId)
        .eq('season', season)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as StatcastMetrics | null;
    },
    enabled: !!playerId
  });
};

export const useIngestStatcastData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playerIds, season = 2025 }: { playerIds?: number[]; season?: number }) => {
      console.log('Triggering Statcast data ingestion...');
      
      const { data, error } = await supabase.functions.invoke('ingest-statcast-data', {
        body: { 
          playerIds,
          season
        }
      });

      if (error) {
        console.error('Statcast ingestion error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      console.log('Statcast data ingestion completed successfully');
      // Invalidate all statcast queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['statcast-data'] });
      queryClient.invalidateQueries({ queryKey: ['player-statcast'] });
    },
    onError: (error) => {
      console.error('Statcast data ingestion failed:', error);
    }
  });
};

export const useIngestGameFeed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gamePk, gameIds }: { gamePk?: number; gameIds?: number[] }) => {
      console.log('Triggering game feed ingestion...');
      
      const { data, error } = await supabase.functions.invoke('ingest-game-feed', {
        body: { 
          gamePk,
          gameIds
        }
      });

      if (error) {
        console.error('Game feed ingestion error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      console.log('Game feed ingestion completed successfully');
      // Invalidate pitch and hit log queries
      queryClient.invalidateQueries({ queryKey: ['pitch-log'] });
      queryClient.invalidateQueries({ queryKey: ['hit-log'] });
    },
    onError: (error) => {
      console.error('Game feed ingestion failed:', error);
    }
  });
};

export const usePitchLog = (gamePk?: number) => {
  return useQuery({
    queryKey: ['pitch-log', gamePk],
    queryFn: async () => {
      let query = supabase
        .from('pitch_log')
        .select('*')
        .order('inning', { ascending: true })
        .order('pitch_number', { ascending: true });

      if (gamePk) {
        query = query.eq('game_pk', gamePk);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!gamePk
  });
};

export const useHitLog = (gamePk?: number) => {
  return useQuery({
    queryKey: ['hit-log', gamePk],
    queryFn: async () => {
      let query = supabase
        .from('hit_log')
        .select('*')
        .order('inning', { ascending: true });

      if (gamePk) {
        query = query.eq('game_pk', gamePk);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!gamePk
  });
};