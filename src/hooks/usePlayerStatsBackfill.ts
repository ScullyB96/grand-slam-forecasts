import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerStatsBackfillRequest {
  season?: number;
  teamIds?: number[];
  playerIds?: number[];
  includeRosters?: boolean;
  includeBattingStats?: boolean;
  includePitchingStats?: boolean;
  force?: boolean;
}

export interface PlayerStatsBackfillResult {
  success: boolean;
  jobId: number;
  season: number;
  stepsCompleted: number;
  totalSteps: number;
  rosterResults?: {
    teamsProcessed: number;
    playersInserted: number;
    playersUpdated: number;
    errors: string[];
  };
  battingResults?: {
    playersProcessed: number;
    statsInserted: number;
    statsUpdated: number;
    errors: string[];
  };
  pitchingResults?: {
    playersProcessed: number;
    statsInserted: number;
    statsUpdated: number;
    skippedNonPitchers: number;
    errors: string[];
  };
  errors: string[];
  message: string;
}

export const usePlayerStatsBackfill = () => {
  return useMutation({
    mutationFn: async (params: PlayerStatsBackfillRequest) => {
      console.log('Starting comprehensive player stats backfill:', params);
      
      const { data, error } = await supabase.functions.invoke('comprehensive-player-stats-backfill', {
        body: params
      });

      if (error) {
        console.error('Player stats backfill error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Player stats backfill failed');
      }

      return data as PlayerStatsBackfillResult;
    },
    onSuccess: (data) => {
      console.log('Player stats backfill completed:', data);
    },
    onError: (error) => {
      console.error('Player stats backfill failed:', error);
    }
  });
};

export const useHistoricalBackfillWithPlayerStats = () => {
  return useMutation({
    mutationFn: async (params: {
      startDate: string;
      endDate: string;
      includeLineups?: boolean;
      includePredictions?: boolean;
      includePlayerStats?: boolean;
      force?: boolean;
    }) => {
      console.log('Starting historical backfill with player stats:', params);
      
      const { data, error } = await supabase.functions.invoke('historical-backfill', {
        body: params
      });

      if (error) {
        console.error('Historical backfill error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Historical backfill failed');
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Historical backfill with player stats completed:', data);
    },
    onError: (error) => {
      console.error('Historical backfill with player stats failed:', error);
    }
  });
};