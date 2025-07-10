
import React from 'react';
import { useGameLineupsRobust } from '@/hooks/useGameLineupsRobust';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Zap, AlertCircle, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LineupDataTabProps {
  gameId: number;
  homeTeam: any;
  awayTeam: any;
}

const LineupDataTab: React.FC<LineupDataTabProps> = ({ gameId, homeTeam, awayTeam }) => {
  const { 
    data: lineups, 
    isLoading, 
    error, 
    validation,
    isRetrying,
    maxRetriesReached,
    nextRetryAt,
    refetch
  } = useGameLineupsRobust(gameId, homeTeam?.id, awayTeam?.id);

  console.log('LineupDataTab - gameId:', gameId, 'lineups:', lineups);

  if (isLoading && !lineups) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading lineup data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading lineup data: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Robust status determination
  const getLineupStatus = () => {
    if (!lineups || lineups.length === 0) {
      return {
        type: 'unavailable' as const,
        message: 'Official lineups not yet released',
        description: 'Lineups are typically announced 1-2 hours before game time.'
      };
    }

    if (validation.isComplete) {
      return {
        type: 'complete' as const,
        message: 'Official lineups confirmed',
        description: 'Updated from MLB API'
      };
    }

    if (isRetrying) {
      return {
        type: 'loading' as const,
        message: 'Lineups partially available - checking for updates',
        description: `Retry ${validation.retryCount}/5 • Next check: ${nextRetryAt?.toLocaleTimeString() || 'soon'}`
      };
    }

    if (maxRetriesReached) {
      return {
        type: 'incomplete' as const,
        message: 'Lineups partially available',
        description: `Some lineup data is missing. Issues: ${validation.issues.join(', ')}`
      };
    }

    return {
      type: 'partial' as const,
      message: 'Lineups partially available',
      description: 'Some players may still be missing from the lineup'
    };
  };

  const status = getLineupStatus();

  const LineupStatus = () => (
    <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 text-sm">
        {status.type === 'complete' && (
          <>
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-green-700 dark:text-green-400 font-medium">{status.message}</span>
          </>
        )}
        {status.type === 'loading' && (
          <>
            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-blue-700 dark:text-blue-400 font-medium">{status.message}</span>
          </>
        )}
        {status.type === 'partial' && (
          <>
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-amber-700 dark:text-amber-400 font-medium">{status.message}</span>
          </>
        )}
        {status.type === 'incomplete' && (
          <>
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-orange-700 dark:text-orange-400 font-medium">{status.message}</span>
          </>
        )}
        {status.type === 'unavailable' && (
          <>
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-700 dark:text-red-400 font-medium">{status.message}</span>
          </>
        )}
        <span className="text-xs text-muted-foreground ml-2">• {status.description}</span>
      </div>
      
      {validation.issues.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          <strong>Issues detected:</strong> {validation.issues.join(', ')}
        </div>
      )}
    </div>
  );

  if (!lineups || lineups.length === 0) {
    return (
      <div className="space-y-4">
        <LineupStatus />
        <div className="text-center text-muted-foreground p-8">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Official Lineups Not Yet Released</h3>
          <p>Official lineups have not been released by MLB for this game.</p>
          <p className="text-sm mt-2">Lineups are typically announced 1-2 hours before game time.</p>
          <p className="text-xs mt-2 text-muted-foreground">Check back closer to game time for official lineups.</p>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            className="mt-4"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Group lineups by team and type
  const groupedLineups = lineups.reduce((acc, lineup) => {
    const teamKey = lineup.team_id === homeTeam?.id ? 'home' : 'away';
    if (!acc[teamKey]) acc[teamKey] = { batting: [], pitching: [] };
    acc[teamKey][lineup.lineup_type as 'batting' | 'pitching'].push(lineup);
    return acc;
  }, {} as { home?: { batting: any[], pitching: any[] }, away?: { batting: any[], pitching: any[] } });

  const renderBattingLineup = (lineups: any[], teamName: string, isComplete: boolean) => {
    const sortedLineups = lineups
      .filter(lineup => lineup.batting_order && lineup.batting_order <= 9)
      .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Batting Order</h4>
          {!isComplete && (
            <Badge variant="outline" className="text-xs">
              {sortedLineups.length}/9
            </Badge>
          )}
        </div>
        
        {sortedLineups.length === 0 ? (
          <div className="text-center text-muted-foreground p-4 border border-dashed rounded">
            <p>Batting lineup not yet available</p>
            {isRetrying && <p className="text-xs mt-1">Checking for updates...</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {sortedLineups.map((player) => (
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
        )}
      </div>
    );
  };

  const renderPitchingLineup = (lineups: any[], teamName: string, hasStartingPitcher: boolean) => {
    const starters = lineups.filter(lineup => lineup.is_starter);
    const relievers = lineups.filter(lineup => !lineup.is_starter);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Pitching</h4>
          {!hasStartingPitcher && (
            <Badge variant="outline" className="text-xs">
              Starter TBD
            </Badge>
          )}
        </div>
        
        {starters.length === 0 ? (
          <div className="text-center text-muted-foreground p-4 border border-dashed rounded">
            <p>Starting pitcher not yet announced</p>
            {isRetrying && <p className="text-xs mt-1">Checking for updates...</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {starters.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded">
                <span className="font-medium">{player.player_name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">SP</Badge>
                  <Badge variant="outline">{player.handedness}HP</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
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
                {validation.awayTeamComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBattingLineup(groupedLineups.away.batting, awayTeam?.name || 'Away', validation.awayLineupCount >= 8)}
              {(groupedLineups.away.batting.length > 0 || groupedLineups.away.pitching.length > 0) && <Separator />}
              {renderPitchingLineup(groupedLineups.away.pitching, awayTeam?.name || 'Away', validation.awayPitchers >= 1)}
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
                {validation.homeTeamComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBattingLineup(groupedLineups.home.batting, homeTeam?.name || 'Home', validation.homeLineupCount >= 8)}
              {(groupedLineups.home.batting.length > 0 || groupedLineups.home.pitching.length > 0) && <Separator />}
              {renderPitchingLineup(groupedLineups.home.pitching, homeTeam?.name || 'Home', validation.homePitchers >= 1)}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Debug information for incomplete lineups */}
      {(maxRetriesReached || (!validation.isComplete && lineups.length > 0)) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Lineup Status:</p>
              <ul className="text-sm space-y-1">
                <li>Home: {validation.homeLineupCount} batters, {validation.homePitchers} pitchers</li>
                <li>Away: {validation.awayLineupCount} batters, {validation.awayPitchers} pitchers</li>
                {validation.issues.length > 0 && (
                  <li className="text-amber-600">Issues: {validation.issues.join(', ')}</li>
                )}
              </ul>
              <Button 
                onClick={() => refetch()} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default LineupDataTab;
