import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Target, TrendingUp, Zap } from 'lucide-react';
import { useGameLineups } from '@/hooks/useGameLineups';
import { usePlayerBattingSplits, usePlayerPitchingSplits } from '@/hooks/usePlayerSplits';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface GamePrediction {
  id: number;
  game_id: number;
  home_win_probability: number;
  away_win_probability: number;
  predicted_home_score?: number;
  predicted_away_score?: number;
  key_factors?: any;
}

interface LineupDataTabProps {
  gameId: number;
  homeTeam: Team;
  awayTeam: Team;
  prediction: GamePrediction;
}

const LineupDataTab: React.FC<LineupDataTabProps> = ({
  gameId,
  homeTeam,
  awayTeam,
  prediction
}) => {
  const { data: lineups, isLoading: lineupsLoading } = useGameLineups(gameId);

  const formatStat = (value: number | null | undefined, decimals = 3) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const getBattingLineup = (teamId: number) => {
    return lineups?.filter(p => p.team_id === teamId && p.lineup_type === 'batting').sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0)) || [];
  };

  const getStartingPitcher = (teamId: number) => {
    return lineups?.find(p => p.team_id === teamId && p.lineup_type === 'pitching' && p.is_starter);
  };

  const PlayerSplitsRow: React.FC<{ playerId: number; playerName: string; position: string; handedness: string }> = ({ 
    playerId, 
    playerName, 
    position, 
    handedness 
  }) => {
    const { data: battingSplits } = usePlayerBattingSplits(playerId, 2025);
    
    const getVsLHP = () => battingSplits?.find(s => s.vs_handedness === 'L');
    const getVsRHP = () => battingSplits?.find(s => s.vs_handedness === 'R');
    
    return (
      <TableRow>
        <TableCell className="font-medium">
          {playerName}
          <div className="flex gap-1 mt-1">
            <Badge variant="outline" className="text-xs">{position}</Badge>
            <Badge variant={handedness === 'L' ? 'destructive' : handedness === 'R' ? 'default' : 'secondary'} className="text-xs">
              {handedness === 'L' ? 'LH' : handedness === 'R' ? 'RH' : 'SW'}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="font-mono text-sm">
            {getVsLHP() ? formatStat(getVsLHP()!.avg) : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">
            {getVsLHP() ? `${getVsLHP()!.at_bats} AB` : ''}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="font-mono text-sm">
            {getVsRHP() ? formatStat(getVsRHP()!.avg) : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">
            {getVsRHP() ? `${getVsRHP()!.at_bats} AB` : ''}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="font-mono text-sm">
            {getVsLHP() ? formatStat(getVsLHP()!.ops) : 'N/A'}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="font-mono text-sm">
            {getVsRHP() ? formatStat(getVsRHP()!.ops) : 'N/A'}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const PitcherSplitsCard: React.FC<{ pitcher: any; teamName: string }> = ({ pitcher, teamName }) => {
    const { data: pitchingSplits } = usePlayerPitchingSplits(pitcher?.player_id || 0, 2025);
    
    const getHomeSplits = () => pitchingSplits?.find(s => s.split_type === 'home');
    const getAwaySplits = () => pitchingSplits?.find(s => s.split_type === 'away');
    const getVsLHB = () => pitchingSplits?.find(s => s.split_type === 'vs_L');
    const getVsRHB = () => pitchingSplits?.find(s => s.split_type === 'vs_R');
    
    if (!pitcher) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{teamName} Starting Pitcher</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground">No starting pitcher found</div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{teamName} Starting Pitcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{pitcher.player_name}</span>
              <Badge variant={pitcher.handedness === 'L' ? 'destructive' : 'default'} className="text-xs">
                {pitcher.handedness === 'L' ? 'LHP' : 'RHP'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Home/Away Splits</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Home ERA:</span>
                    <span className="font-mono">{getHomeSplits() ? formatStat(getHomeSplits()!.era, 2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Away ERA:</span>
                    <span className="font-mono">{getAwaySplits() ? formatStat(getAwaySplits()!.era, 2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Home WHIP:</span>
                    <span className="font-mono">{getHomeSplits() ? formatStat(getHomeSplits()!.whip, 2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Away WHIP:</span>
                    <span className="font-mono">{getAwaySplits() ? formatStat(getAwaySplits()!.whip, 2) : 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">vs LHB/RHB</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>vs LHB AVG:</span>
                    <span className="font-mono">{getVsLHB() && getVsLHB()!.hits_allowed > 0 ? formatStat((getVsLHB()!.hits_allowed / Math.max(1, getVsLHB()!.innings_pitched * 3))) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>vs RHB AVG:</span>
                    <span className="font-mono">{getVsRHB() && getVsRHB()!.hits_allowed > 0 ? formatStat((getVsRHB()!.hits_allowed / Math.max(1, getVsRHB()!.innings_pitched * 3))) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>vs LHB K/9:</span>
                    <span className="font-mono">{getVsLHB() ? formatStat(getVsLHB()!.k_9, 1) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>vs RHB K/9:</span>
                    <span className="font-mono">{getVsRHB() ? formatStat(getVsRHB()!.k_9, 1) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (lineupsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lineups || lineups.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Lineup Data Available</h3>
            <p className="text-muted-foreground">
              Lineups haven't been loaded for this game yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const homeBatters = getBattingLineup(homeTeam.id);
  const awayBatters = getBattingLineup(awayTeam.id);
  const homePitcher = getStartingPitcher(homeTeam.id);
  const awayPitcher = getStartingPitcher(awayTeam.id);

  const isLineupBased = prediction.key_factors?.lineup_based;

  return (
    <div className="space-y-6">
      {/* Lineup Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Lineup-Based Prediction Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={isLineupBased ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {isLineupBased ? 'Lineup-Based' : 'Team Stats Based'}
            </Badge>
            {isLineupBased && (
              <div className="text-sm text-muted-foreground">
                Using individual player matchups and splits
              </div>
            )}
          </div>
          
          {isLineupBased && prediction.key_factors && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Home Expected:</span>
                <div className="font-mono">{prediction.key_factors.home_expected_runs?.toFixed(2) || 'N/A'} runs</div>
              </div>
              <div>
                <span className="font-medium">Away Expected:</span>
                <div className="font-mono">{prediction.key_factors.away_expected_runs?.toFixed(2) || 'N/A'} runs</div>
              </div>
              <div>
                <span className="font-medium">Home Lineup:</span>
                <div>{prediction.key_factors.home_lineup_size || 0} players</div>
              </div>
              <div>
                <span className="font-medium">Away Lineup:</span>
                <div>{prediction.key_factors.away_lineup_size || 0} players</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Starting Pitchers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PitcherSplitsCard pitcher={awayPitcher} teamName={awayTeam.name} />
        <PitcherSplitsCard pitcher={homePitcher} teamName={homeTeam.name} />
      </div>

      {/* Batting Lineups with Splits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Batting Lineups & Splits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="away" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="away">{awayTeam.name}</TabsTrigger>
              <TabsTrigger value="home">{homeTeam.name}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="away" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">vs LHP AVG</TableHead>
                      <TableHead className="text-center">vs RHP AVG</TableHead>
                      <TableHead className="text-center">vs LHP OPS</TableHead>
                      <TableHead className="text-center">vs RHP OPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {awayBatters.map((player) => (
                      <PlayerSplitsRow
                        key={player.id}
                        playerId={player.player_id}
                        playerName={`${player.batting_order}. ${player.player_name}`}
                        position={player.position}
                        handedness={player.handedness}
                      />
                    ))}
                    {awayBatters.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No batting lineup available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="home" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">vs LHP AVG</TableHead>
                      <TableHead className="text-center">vs RHP AVG</TableHead>
                      <TableHead className="text-center">vs LHP OPS</TableHead>
                      <TableHead className="text-center">vs RHP OPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {homeBatters.map((player) => (
                      <PlayerSplitsRow
                        key={player.id}
                        playerId={player.player_id}
                        playerName={`${player.batting_order}. ${player.player_name}`}
                        position={player.position}
                        handedness={player.handedness}
                      />
                    ))}
                    {homeBatters.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No batting lineup available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LineupDataTab;