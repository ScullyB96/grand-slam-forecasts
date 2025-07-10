
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LineupIngestionResult {
  success: boolean;
  date: string;
  games_expected: number;
  games_processed: number;
  games_failed: number;
  failed_games: Array<{
    gamePk: number;
    error: string;
  }>;
  job_id: string;
  message: string;
}

export const useLineupIngestion = () => {
  return useMutation({
    mutationFn: async ({ date, force = false }: { date?: string; force?: boolean }) => {
      console.log('Starting lineup ingestion...', { date, force });
      
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase.functions.invoke('ingest-lineups', {
        body: { date: targetDate, force }
      });

      if (error) {
        console.error('Lineup ingestion error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Lineup ingestion failed');
      }

      return data as LineupIngestionResult;
    },
    onSuccess: (data) => {
      console.log('Lineup ingestion completed:', data);
    },
    onError: (error) => {
      console.error('Lineup ingestion failed:', error);
    }
  });
};
