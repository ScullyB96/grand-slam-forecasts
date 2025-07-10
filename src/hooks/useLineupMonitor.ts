import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LineupMonitorResult {
  success: boolean;
  checked: number;
  updated: number;
  total_games: number;
  updates: string[];
  timestamp: string;
  message: string;
}

export const useLineupMonitor = () => {
  return useMutation({
    mutationFn: async () => {
      console.log('Starting lineup monitoring...');
      
      const { data, error } = await supabase.functions.invoke('lineup-monitor');

      if (error) {
        console.error('Lineup monitor error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Lineup monitoring failed');
      }

      return data as LineupMonitorResult;
    },
    onSuccess: (data) => {
      console.log('Lineup monitoring completed:', data);
    },
    onError: (error) => {
      console.error('Lineup monitoring failed:', error);
    }
  });
};