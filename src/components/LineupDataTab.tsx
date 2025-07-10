
import React from 'react';
import { useGameLineups, GameLineup } from '@/hooks/useGameLineups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLineupIngestion } from '@/hooks/useLineupIngestion';
import { useToast } from '@/hooks/use-toast';

interface LineupDataTabProps {
  gameId: number;
  homeTeam: any;
  awayTeam: any;
}

const LineupDataTab: React.FC<LineupDataTabProps> = ({ gameId, homeTeam, awayTeam }) => {
  const { data: lineups, isLoading, error, refetch } = useGameLineups(gameId);
  const lineupIngestion = useLineupIngestion();
  const { toast } = useToast();

  console.log('LineupDataTab - gameId:', gameId, 'lineups:', lineups);

  const handleRefreshLineups = async () => {
    try {
      await lineupIngestion.mutateAsync({
        date: new Date().toISOString().split('T')[0],
        force: true
      });
      
      toast({
        title: "Lineups Updated",
        description: "Successfully refreshed lineup data from MLB API",
      });
      
      // Refetch the lineups after successful ingestion
      setTimeout(() => refetch(), 2000);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          className="mt-2 ml-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!lineups || lineups.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Official Lineups Not Yet Released</h3>
        <p>Official lineups have not been released by MLB for this game.</p>
        <p className="text-sm mt-2">Lineups are typically announced 1-2 hours before game time.</p>
        <Button 
          onClick={handleRefreshLineups}
          disabled={lineupIngestion.isPending}
          className="mt-4"
        >
          {lineupIngestion.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking for Updates...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Official Lineups
            </>
          )}
        </Button>
        <p className="text-xs mt-2 text-muted-foreground">This will fetch the latest data from MLB's official API.</p>
      </div>
    );
  }

  // Check if lineups are official
  const hasOfficialLineups = lineups.some(lineup => 
    lineup.lineup_type === 'batting' && lineup.batting_order !== null
  );

  const LineupStatus = () => (
    <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {hasOfficialLineups ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-700 dark:text-green-400 font-medium">Official Lineups Confirmed</span>
              <span className="text-xs text-muted-foreground ml-2">• Updated from MLB API</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-orange-700 dark:text-orange-400 font-medium">Partial Lineup Data</span>
              <span className="text-xs text-muted-foreground ml-2">• Only pitchers available</span>
            </>
          )}
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRefreshLineups}
          disabled={lineupIngestion.isPending}
        >
          {lineupIngestion.isPending ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );

  // Group lineups by team and type
  const groupedLineups = lineups.reduce((acc, lineup) => {
    const teamKey = lineup.team_id === homeTeam?.id ? 'home' : 'away';
    if (!acc[teamKey]) acc[teamKey] = { batting: [], pitching: [] };
    acc[teamKey][lineup.lineup_type].push(lineup);
    return acc;
  }, {} as { home?: { batting: GameLineup[], pitching: GameLineup[] }, away?: { batting: GameLineup[], pitching: GameLineup[] } });

  const renderBattingLineup = (lineups: GameLineup[], teamName: string) => {
    const sortedLineups = lineups
      .filter(lineup => lineup.batting_order && lineup.batting_order <= 9)
      .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));
    
    if (sortedLineups.length === 0) {
      return (
        <div className="text-center text-muted-foreground p-4">
          <p>Batting lineup not yet available</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Batting Order</h4>
        </div>
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
      </div>
    );
  };

  const renderPitchingLineup = (lineups: GameLineup[], teamName: string) => {
    const pitchers = lineups.filter(lineup => lineup.lineup_type === 'pitching');

    if (pitchers.length === 0) {
      return (
        <div className="text-center text-muted-foreground p-4">
          <p>Starting pitcher not yet announced</p>
        </div>
      );
    }

    const starters = pitchers.filter(p => p.is_starter);
    const relievers = pitchers.filter(p => !p.is_starter);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" />
          <h4 className="font-semibold">{teamName} Pitchers</h4>
        </div>
        
        {starters.map((player) => (
          <div key={player.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded">
            <div className="flex items-center gap-2">
              <Badge variant="default">SP</Badge>
              <span className="font-medium">{player.player_name}</span>
            </div>
            <Badge variant="outline">{player.handedness}HP</Badge>
          </div>
        ))}
        
        {relievers.length > 0 && (
          <div className="mt-3">
            <h5 className="text-sm font-medium text-muted-foreground mb-2">Relief Pitchers</h5>
            {relievers.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-2 bg-muted/30 rounded mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">RP</Badge>
                  <span className="text-sm">{player.player_name}</span>
                </div>
                <Badge variant="outline" className="text-xs">{player.handedness}HP</Badge>
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBattingLineup(groupedLineups.away.batting, awayTeam?.name || 'Away')}
              {(groupedLineups.away.batting.length > 0 || groupedLineups.away.pitching.length > 0) && 
                <Separator />
              }
              {renderPitchingLineup(groupedLineups.away.pitching, awayTeam?.name || 'Away')}
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
              {renderBattingLineup(groupedLineups.home.batting, homeTeam?.name || 'Home')}
              {(groupedLineups.home.batting.length > 0 || groupedLineups.home.pitching.length > 0) && 
                <Separator />
              }
              {renderPitchingLineup(groupedLineups.home.pitching, homeTeam?.name || 'Home')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LineupDataTab;
