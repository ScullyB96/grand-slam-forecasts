
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamStatsWithTeam {
  id: number;
  team_id: number;
  season: number;
  wins: number;
  losses: number;
  runs_scored: number;
  runs_allowed: number;
  team_era: number;
  team_avg: number;
  team_obp: number;
  team_slg: number;
  team: {
    id: number;
    name: string;
    abbreviation: string;
    league: string;
    division: string;
    city?: string;
    venue_name?: string;
  };
}

export const useTeamStats = (season?: number) => {
  return useQuery({
    queryKey: ['team-stats', season],
    queryFn: async () => {
      let query = supabase
        .from('team_stats')
        .select(`
          *,
          team:teams!team_stats_team_id_fkey(
            id,
            name,
            abbreviation,
            league,
            division,
            city,
            venue_name
          )
        `);

      if (season) {
        query = query.eq('season', season);
      }

      query = query.order('wins', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching team stats:', error);
        throw error;
      }

      return data as TeamStatsWithTeam[];
    },
  });
};

export const useTeamStatsByTeam = (teamId: number, season?: number) => {
  return useQuery({
    queryKey: ['team-stats', teamId, season],
    queryFn: async () => {
      let query = supabase
        .from('team_stats')
        .select(`
          *,
          team:teams!team_stats_team_id_fkey(
            id,
            name,
            abbreviation,
            league,
            division,
            city,
            venue_name
          )
        `)
        .eq('team_id', teamId);

      if (season) {
        query = query.eq('season', season);
      } else {
        query = query.order('season', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching team stats:', error);
        throw error;
      }

      return data as TeamStatsWithTeam | null;
    },
  });
};
