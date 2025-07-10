
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface JobDetails {
  id: string;
  job_name: string;
  job_type: string;
  data_source: string;
  status: string;
  started_at: string;
  completed_at?: string;
  records_processed?: number;
  records_inserted?: number;
  errors_count?: number;
  error_details?: any;
  season?: number;
  created_at: string;
}

interface DebugResponse {
  success: boolean;
  lastJob: JobDetails | null;
  summary: {
    hasData: boolean;
    lastRun: string | null;
    status: string;
  };
}

export const useScheduleDebug = () => {
  return useQuery({
    queryKey: ['schedule-debug'],
    queryFn: async (): Promise<DebugResponse> => {
      console.log('Fetching schedule debug logs...');
      
      const { data, error } = await supabase.functions.invoke('fetch-schedule/debug-schedule');

      if (error) {
        console.error('Error fetching debug logs:', error);
        throw new Error(`Failed to fetch debug logs: ${error.message}`);
      }

      console.log('Debug logs response:', data);
      return data as DebugResponse;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

export const useVerifyIngestion = (date: string) => {
  return useQuery({
    queryKey: ['verify-ingestion', date],
    queryFn: async () => {
      console.log(`Verifying ingestion for date: ${date}`);
      
      const { data: games, error } = await supabase
        .from('games')
        .select('id, game_id, game_date, status')
        .eq('game_date', date);

      if (error) {
        console.error('Error verifying ingestion:', error);
        throw error;
      }

      const gameCount = games?.length || 0;
      console.log(`Verification complete: Found ${gameCount} games for ${date}`);
      
      return {
        success: gameCount > 0,
        gameCount,
        games: games || []
      };
    },
    enabled: !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
