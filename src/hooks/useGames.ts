
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Game {
  id: number;
  game_id: number;
  game_date: string;
  game_time?: string;
  home_team_id: number;
  away_team_id: number;
  venue_name?: string;
  status: string;
  home_score?: number;
  away_score?: number;
  home_team: {
    id: number;
    name: string;
    abbreviation: string;
    league: string;
    division: string;
  };
  away_team: {
    id: number;
    name: string;
    abbreviation: string;
    league: string;
    division: string;
  };
}

export const useGames = (date?: string) => {
  return useQuery({
    queryKey: ['games', date],
    queryFn: async () => {
      console.log(`Fetching games for date: ${date || 'all'}`);
      
      let query = supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(id, name, abbreviation, league, division),
          away_team:teams!games_away_team_id_fkey(id, name, abbreviation, league, division)
        `);

      if (date) {
        query = query.eq('game_date', date);
      }

      query = query.order('game_date', { ascending: true })
                   .order('game_time', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching games:', error);
        throw new Error(`Failed to fetch games: ${error.message}`);
      }

      console.log(`Successfully fetched ${data?.length || 0} games`);
      return data as Game[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

export const useTodaysGames = () => {
  const today = new Date().toISOString().split('T')[0];
  return useGames(today);
};

// Enhanced hook to trigger schedule fetch with better error handling
export const useFetchSchedule = (date?: string) => {
  return useQuery({
    queryKey: ['fetch-schedule', date],
    queryFn: async () => {
      const targetDate = date || new Date().toISOString().split('T')[0];
      console.log(`Triggering schedule fetch for date: ${targetDate}`);
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-schedule', {
          body: { date: targetDate }
        });

        if (error) {
          console.error('Error invoking fetch-schedule function:', error);
          throw new Error(`Failed to invoke fetch-schedule: ${error.message}`);
        }

        if (!data) {
          throw new Error('No response data from fetch-schedule function');
        }

        // Validate response structure
        if (typeof data !== 'object') {
          throw new Error('Invalid response format from fetch-schedule function');
        }

        console.log('Schedule fetch response:', data);

        // Check if the response indicates success
        if (data.success === false) {
          throw new Error(data.error || 'Schedule fetch failed');
        }

        return data;
      } catch (error) {
        console.error('Schedule fetch failed:', error);
        throw error;
      }
    },
    enabled: false, // Only run when manually triggered
    retry: 1, // Only retry once for manual operations
  });
};
