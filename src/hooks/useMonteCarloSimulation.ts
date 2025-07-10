import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MonteCarloResult {
  success: boolean;
  game_id: number;
  iterations: number;
  simulation_stats: {
    home_win_probability: number;
    away_win_probability: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_total_runs: number;
    over_probability: number;
    under_probability: number;
    over_under_line: number;
    confidence_score: number;
    sample_size: number;
  };
  factors: {
    park_factor: number;
    weather_impact: number;
    home_advantage: number;
    pitcher_fatigue: number;
  };
  timestamp: string;
}

export const useMonteCarloSimulation = () => {
  return useMutation({
    mutationFn: async ({ gameId, iterations = 10000 }: { gameId: number; iterations?: number }) => {
      console.log(`Starting Monte Carlo simulation for game ${gameId} with ${iterations} iterations`);
      
      const { data, error } = await supabase.functions.invoke('monte-carlo-simulation', {
        body: { 
          game_id: gameId,
          iterations 
        }
      });

      if (error) {
        console.error('Monte Carlo simulation error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Monte Carlo simulation failed');
      }

      return data as MonteCarloResult;
    },
    onSuccess: (data) => {
      console.log('Monte Carlo simulation completed:', data);
    },
    onError: (error) => {
      console.error('Monte Carlo simulation failed:', error);
    }
  });
};

export const useGeneratePredictions = () => {
  return useMutation({
    mutationFn: async () => {
      console.log('Generating predictions with Monte Carlo simulation...');
      
      const { data, error } = await supabase.functions.invoke('generate-predictions');

      if (error) {
        console.error('Generate predictions error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Predictions generated:', data);
    },
    onError: (error) => {
      console.error('Generate predictions failed:', error);
    }
  });
};