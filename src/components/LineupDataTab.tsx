import React from 'react';
import { useGameLineups, GameLineup } from '@/hooks/useGameLineups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Zap } from 'lucide-react';

interface LineupDataTabProps {
  gameId: number;
  homeTeam: any;
  awayTeam: any;
}

const LineupDataTab: React.FC<LineupDataTabProps> = ({ gameId, homeTeam, awayTeam }) => {
  const { data: lineups, isLoading, error } = useGameLineups(gameId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        Error loading lineup data: {error.message}
      </div>
    );
  }

  if (!lineups || lineups.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Lineup Data Available</h3>
        <p>Official lineups haven't been released yet for this game.</p>
        <p className="text-sm mt-2">We automatically check for official lineups every 15 minutes.</p>
      </div>
    );
  }

  // Check if lineups are official or projected
  const hasOfficialLineups = lineups.some(lineup => 
    !lineup.player_name.includes('Player (') && 
    !lineup.player_name.includes('Mock') &&
    !lineup.player_name.includes('Starting Pitcher (')
  );

  const LineupStatus = () => (
    <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 text-sm">
        {hasOfficialLineups ? (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-700 dark:text-green-400 font-medium">Official Lineups Confirmed</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-yellow-700 dark:text-yellow-400 font-medium">Projected Lineups (Auto-updating every 15 minutes)</span>
          </>
        )}
      </div>
    </div>
  );

  // Group lineups by team and type
  const groupedLineups = lineups.reduce((acc, lineup) => {
    const teamKey = lineup.team_id === homeTeam?.id ? 'home' : 'away';
    if (!acc[teamKey]) acc[teamKey] = { batting: [], pitching: [] };
    acc[teamKey][lineup.lineup_type as 'batting' | 'pitching'].push(lineup);
    return acc;
  }, {} as { home?: { batting: GameLineup[], pitching: GameLineup[] }, away?: { batting: GameLineup[], pitching: GameLineup[] } });

  const renderBattingLineup = (lineups: GameLineup[], teamName: string) => {
    const sortedLineups = lineups.sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Batting Order</h4>
        </div>
        <div className="space-y-1">
          {sortedLineups.map((player, index) => (
            <div key={player.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                  {player.batting_order}
                </Badge>
                <span className="font-medium">{player.player_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{player.position}</Badge>
                <Badge variant="outline">{player.handedness}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPitchingLineup = (lineups: GameLineup[], teamName: string) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Starting Pitcher</h4>
        </div>
        {lineups.map((player) => (
          <div key={player.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded">
            <span className="font-medium">{player.player_name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{player.position}</Badge>
              <Badge variant="outline">{player.handedness}HP</Badge>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <LineupStatus />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Away Team */}
      {groupedLineups.away && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {awayTeam?.name || 'Away Team'}
              <Badge variant="secondary">Away</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedLineups.away.batting.length > 0 && 
              renderBattingLineup(groupedLineups.away.batting, awayTeam?.name || 'Away')
            }
            {groupedLineups.away.batting.length > 0 && groupedLineups.away.pitching.length > 0 && 
              <Separator />
            }
            {groupedLineups.away.pitching.length > 0 && 
              renderPitchingLineup(groupedLineups.away.pitching, awayTeam?.name || 'Away')
            }
          </CardContent>
        </Card>
      )}

      {/* Home Team */}
      {groupedLineups.home && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {homeTeam?.name || 'Home Team'}
              <Badge variant="secondary">Home</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedLineups.home.batting.length > 0 && 
              renderBattingLineup(groupedLineups.home.batting, homeTeam?.name || 'Home')
            }
            {groupedLineups.home.batting.length > 0 && groupedLineups.home.pitching.length > 0 && 
              <Separator />
            }
            {groupedLineups.home.pitching.length > 0 && 
              renderPitchingLineup(groupedLineups.home.pitching, homeTeam?.name || 'Home')
            }
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
};

export default LineupDataTab;