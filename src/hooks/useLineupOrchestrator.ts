import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LineupOrchestratorResult {
  success: boolean;
  date: string;
  timestamp: string;
  steps_completed: string[];
  results: {
    games_found: number;
    schedule_result?: any;
    lineup_result?: any;
    monitor_result?: any;
    prediction_result?: any;
  };
  message: string;
}

export const useLineupOrchestrator = () => {
  return useMutation({
    mutationFn: async (date?: string) => {
      console.log('Starting lineup orchestration...');
      
      const { data, error } = await supabase.functions.invoke('lineup-orchestrator', {
        body: { date: date || new Date().toISOString().split('T')[0] }
      });

      if (error) {
        console.error('Lineup orchestrator error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Lineup orchestration failed');
      }

      return data as LineupOrchestratorResult;
    },
    onSuccess: (data) => {
      console.log('Lineup orchestration completed:', data);
    },
    onError: (error) => {
      console.error('Lineup orchestration failed:', error);
    }
  });
};