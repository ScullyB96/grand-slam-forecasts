
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
        throw error;
      }

      console.log(`Successfully fetched ${data?.length || 0} games`);
      return data as Game[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  });
};

export const useTodaysGames = () => {
  const today = new Date().toISOString().split('T')[0];
  return useGames(today);
};

// Hook to trigger schedule fetch
export const useFetchSchedule = () => {
  return useQuery({
    queryKey: ['fetch-schedule'],
    queryFn: async () => {
      console.log('Triggering schedule fetch...');
      
      const { data, error } = await supabase.functions.invoke('fetch-schedule', {
        body: { date: new Date().toISOString().split('T')[0] }
      });

      if (error) {
        console.error('Error triggering schedule fetch:', error);
        throw error;
      }

      console.log('Schedule fetch response:', data);
      return data;
    },
    enabled: false, // Only run when manually triggered
  });
};
