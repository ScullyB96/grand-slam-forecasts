
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GamePrediction {
  id: number;
  game_id: number;
  home_win_probability: number;
  away_win_probability: number;
  predicted_home_score?: number;
  predicted_away_score?: number;
  over_under_line?: number;
  over_probability?: number;
  under_probability?: number;
  confidence_score?: number;
  key_factors?: any;
  prediction_date: string;
  last_updated?: string;
}

export const usePredictions = (gameIds?: number[]) => {
  return useQuery({
    queryKey: ['predictions', gameIds],
    queryFn: async () => {
      let query = supabase
        .from('game_predictions')
        .select('*')
        .order('prediction_date', { ascending: false });

      if (gameIds && gameIds.length > 0) {
        query = query.in('game_id', gameIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching predictions:', error);
        throw error;
      }

      return data as GamePrediction[];
    },
    enabled: !gameIds || gameIds.length > 0,
  });
};

export const useGamePrediction = (gameId: number) => {
  return useQuery({
    queryKey: ['prediction', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_predictions')
        .select('*')
        .eq('game_id', gameId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching prediction:', error);
        throw error;
      }

      return data as GamePrediction | null;
    },
  });
};
