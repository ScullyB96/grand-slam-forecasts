
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LineupJob {
  id: string;
  job_date: string;
  status: string;
  games_expected: number;
  games_processed: number;
  games_failed: number;
  failed_games: any[];
  started_at: string;
  completed_at: string | null;
  error_details: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
}

export const useLineupJobs = (date?: string) => {
  return useQuery({
    queryKey: ['lineup-jobs', date],
    queryFn: async () => {
      let query = supabase
        .from('lineup_ingestion_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (date) {
        query = query.eq('job_date', date);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching lineup jobs:', error);
        throw error;
      }

      return data as LineupJob[];
    },
  });
};

export const useLatestLineupJob = (date?: string) => {
  return useQuery({
    queryKey: ['latest-lineup-job', date],
    queryFn: async () => {
      let query = supabase
        .from('lineup_ingestion_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (date) {
        query = query.eq('job_date', date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching latest lineup job:', error);
        throw error;
      }

      return data?.[0] as LineupJob | null;
    },
  });
};
