
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export interface GameLineup {
  id: string;
  game_pk: number;
  team_id: number;
  player_id: number;
  player_name: string;
  batting_order: number | null;
  position_code: string | null;
  position: string;
  lineup_type: 'batting' | 'pitching';
  handedness: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface LineupValidation {
  isComplete: boolean;
  homeTeamComplete: boolean;
  awayTeamComplete: boolean;
  homeLineupCount: number;
  awayLineupCount: number;
  homePitchers: number;
  awayPitchers: number;
  issues: string[];
  retryCount: number;
  nextRetryAt: Date | null;
}

const MINIMUM_LINEUP_SIZE = 8; // Allow some flexibility
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 30000; // 30 seconds

export const useGameLineupsRobust = (gamePk: number, homeTeamId?: number, awayTeamId?: number) => {
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<Date | null>(null);

  const query = useQuery({
    queryKey: ['game-lineups-robust', gamePk, retryCount],
    queryFn: async () => {
      console.log(`🔍 Fetching lineups for game ${gamePk} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      const { data, error } = await supabase
        .from('game_lineups')
        .select('*')
        .eq('game_id', gamePk)
        .order('team_id')
        .order('batting_order');

      if (error) {
        console.error('❌ Error fetching game lineups:', error);
        throw error;
      }

      console.log(`📊 Found ${data?.length || 0} lineup entries for game ${gamePk}`);

      // Transform the data to match the expected interface
      const transformedData: GameLineup[] = (data || []).map(lineup => ({
        id: lineup.id,
        game_pk: gamePk,
        team_id: lineup.team_id,
        player_id: lineup.player_id,
        player_name: lineup.player_name || `Player ${lineup.player_id}`,
        batting_order: lineup.batting_order,
        position_code: lineup.position || null,
        position: lineup.position || 'Unknown',
        lineup_type: lineup.lineup_type as 'batting' | 'pitching',
        handedness: lineup.handedness || 'R',
        date: new Date().toISOString().split('T')[0],
        created_at: lineup.created_at,
        updated_at: lineup.updated_at
      }));

      return transformedData;
    },
    enabled: !!gamePk,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Validate lineup completeness
  const validation: LineupValidation = {
    isComplete: false,
    homeTeamComplete: false,
    awayTeamComplete: false,
    homeLineupCount: 0,
    awayLineupCount: 0,
    homePitchers: 0,
    awayPitchers: 0,
    issues: [],
    retryCount,
    nextRetryAt
  };

  if (query.data && homeTeamId && awayTeamId) {
    const homeLineups = query.data.filter(l => l.team_id === homeTeamId);
    const awayLineups = query.data.filter(l => l.team_id === awayTeamId);

    validation.homeLineupCount = homeLineups.filter(l => l.lineup_type === 'batting').length;
    validation.awayLineupCount = awayLineups.filter(l => l.lineup_type === 'batting').length;
    validation.homePitchers = homeLineups.filter(l => l.lineup_type === 'pitching').length;
    validation.awayPitchers = awayLineups.filter(l => l.lineup_type === 'pitching').length;

    validation.homeTeamComplete = validation.homeLineupCount >= MINIMUM_LINEUP_SIZE && validation.homePitchers >= 1;
    validation.awayTeamComplete = validation.awayLineupCount >= MINIMUM_LINEUP_SIZE && validation.awayPitchers >= 1;
    validation.isComplete = validation.homeTeamComplete && validation.awayTeamComplete;

    // Generate issues list
    if (validation.homeLineupCount < MINIMUM_LINEUP_SIZE) {
      validation.issues.push(`Home team only has ${validation.homeLineupCount} batters (need ${MINIMUM_LINEUP_SIZE})`);
    }
    if (validation.awayLineupCount < MINIMUM_LINEUP_SIZE) {
      validation.issues.push(`Away team only has ${validation.awayLineupCount} batters (need ${MINIMUM_LINEUP_SIZE})`);
    }
    if (validation.homePitchers === 0) {
      validation.issues.push('Home team missing starting pitcher');
    }
    if (validation.awayPitchers === 0) {
      validation.issues.push('Away team missing starting pitcher');
    }
  }

  // Auto-retry logic for incomplete lineups
  useEffect(() => {
    if (query.data && !validation.isComplete && retryCount < MAX_RETRIES && !query.isFetching) {
      console.log(`⏳ Lineup incomplete for game ${gamePk}, scheduling retry ${retryCount + 1}/${MAX_RETRIES}`);
      
      const nextRetry = new Date(Date.now() + RETRY_INTERVAL);
      setNextRetryAt(nextRetry);
      
      const timeoutId = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setNextRetryAt(null);
      }, RETRY_INTERVAL);

      return () => clearTimeout(timeoutId);
    }
  }, [query.data, validation.isComplete, retryCount, query.isFetching, gamePk]);

  return {
    ...query,
    validation,
    isRetrying: retryCount > 0 && retryCount < MAX_RETRIES,
    maxRetriesReached: retryCount >= MAX_RETRIES,
    nextRetryAt
  };
};
