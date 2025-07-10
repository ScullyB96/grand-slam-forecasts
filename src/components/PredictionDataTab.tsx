import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BarChart3, Target, TrendingUp, Database } from 'lucide-react';
import { useTeamStatsByTeam } from '@/hooks/useTeamStats';
import { usePlayers } from '@/hooks/usePlayers';
import { useBattingStats } from '@/hooks/useBattingStats';
import { usePitchingStats } from '@/hooks/usePitchingStats';

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

interface PredictionDataTabProps {
  gameId: number;
  homeTeam: Team;
  awayTeam: Team;
  prediction: GamePrediction;
}

const PredictionDataTab: React.FC<PredictionDataTabProps> = ({
  gameId,
  homeTeam,
  awayTeam,
  prediction
}) => {
  // Fetch team data
  const { data: homeTeamStats } = useTeamStatsByTeam(homeTeam.id, 2025);
  const { data: awayTeamStats } = useTeamStatsByTeam(awayTeam.id, 2025);
  
  // Fetch player data
  const { data: homePlayers } = usePlayers(homeTeam.id);
  const { data: awayPlayers } = usePlayers(awayTeam.id);
  
  // Fetch batting and pitching stats
  const { data: homeBattingStats } = useBattingStats(2025, homeTeam.id);
  const { data: awayBattingStats } = useBattingStats(2025, awayTeam.id);
  const { data: homePitchingStats } = usePitchingStats(2025, homeTeam.id);
  const { data: awayPitchingStats } = usePitchingStats(2025, awayTeam.id);

  const formatStat = (value: number | null | undefined, decimals = 3) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const getTopHitters = (stats: any[]) => {
    return stats?.slice(0, 5) || [];
  };

  const getTopPitchers = (stats: any[]) => {
    return stats?.slice(0, 3) || [];
  };

  return (
    <div className="space-y-6">
      {/* Team Statistics Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Team Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Away Team Stats */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg border-b pb-2">{awayTeam.name}</h3>
              {awayTeamStats ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1">
                    <div><strong>Record:</strong> {awayTeamStats.wins}-{awayTeamStats.losses}</div>
                    <div><strong>Win %:</strong> {formatStat(awayTeamStats.wins / (awayTeamStats.wins + awayTeamStats.losses))}</div>
                    <div><strong>Runs/Game:</strong> {formatStat(awayTeamStats.runs_scored / (awayTeamStats.wins + awayTeamStats.losses), 2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Team AVG:</strong> {formatStat(awayTeamStats.team_avg)}</div>
                    <div><strong>Team OBP:</strong> {formatStat(awayTeamStats.team_obp)}</div>
                    <div><strong>Team ERA:</strong> {formatStat(awayTeamStats.team_era, 2)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No team stats available</div>
              )}
            </div>

            {/* Home Team Stats */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg border-b pb-2">{homeTeam.name}</h3>
              {homeTeamStats ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1">
                    <div><strong>Record:</strong> {homeTeamStats.wins}-{homeTeamStats.losses}</div>
                    <div><strong>Win %:</strong> {formatStat(homeTeamStats.wins / (homeTeamStats.wins + homeTeamStats.losses))}</div>
                    <div><strong>Runs/Game:</strong> {formatStat(homeTeamStats.runs_scored / (homeTeamStats.wins + homeTeamStats.losses), 2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Team AVG:</strong> {formatStat(homeTeamStats.team_avg)}</div>
                    <div><strong>Team OBP:</strong> {formatStat(homeTeamStats.team_obp)}</div>
                    <div><strong>Team ERA:</strong> {formatStat(homeTeamStats.team_era, 2)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No team stats available</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Player Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hitting" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hitting">Hitting</TabsTrigger>
              <TabsTrigger value="pitching">Pitching</TabsTrigger>
            </TabsList>
            
            <TabsContent value="hitting" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Away Team Hitters */}
                <div>
                  <h3 className="font-semibold mb-3">{awayTeam.name} Top Hitters</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">AVG</TableHead>
                          <TableHead className="text-right">HR</TableHead>
                          <TableHead className="text-right">RBI</TableHead>
                          <TableHead className="text-right">OPS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTopHitters(awayBattingStats || []).map((stat) => (
                          <TableRow key={stat.id}>
                            <TableCell className="font-medium">
                              {stat.player?.full_name || 'Unknown'}
                              {stat.player?.position && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {stat.player.position}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.avg)}</TableCell>
                            <TableCell className="text-right">{stat.home_runs || 0}</TableCell>
                            <TableCell className="text-right">{stat.rbi || 0}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.ops)}</TableCell>
                          </TableRow>
                        ))}
                        {(!awayBattingStats || awayBattingStats.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No batting stats available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Home Team Hitters */}
                <div>
                  <h3 className="font-semibold mb-3">{homeTeam.name} Top Hitters</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">AVG</TableHead>
                          <TableHead className="text-right">HR</TableHead>
                          <TableHead className="text-right">RBI</TableHead>
                          <TableHead className="text-right">OPS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTopHitters(homeBattingStats || []).map((stat) => (
                          <TableRow key={stat.id}>
                            <TableCell className="font-medium">
                              {stat.player?.full_name || 'Unknown'}
                              {stat.player?.position && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {stat.player.position}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.avg)}</TableCell>
                            <TableCell className="text-right">{stat.home_runs || 0}</TableCell>
                            <TableCell className="text-right">{stat.rbi || 0}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.ops)}</TableCell>
                          </TableRow>
                        ))}
                        {(!homeBattingStats || homeBattingStats.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No batting stats available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="pitching" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Away Team Pitchers */}
                <div>
                  <h3 className="font-semibold mb-3">{awayTeam.name} Top Pitchers</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">ERA</TableHead>
                          <TableHead className="text-right">W-L</TableHead>
                          <TableHead className="text-right">WHIP</TableHead>
                          <TableHead className="text-right">K/9</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTopPitchers(awayPitchingStats || []).map((stat) => (
                          <TableRow key={stat.id}>
                            <TableCell className="font-medium">
                              {stat.player?.full_name || 'Unknown'}
                              {stat.player?.position && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {stat.player.position}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.era, 2)}</TableCell>
                            <TableCell className="text-right">{stat.wins || 0}-{stat.losses || 0}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.whip, 2)}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.k_9, 1)}</TableCell>
                          </TableRow>
                        ))}
                        {(!awayPitchingStats || awayPitchingStats.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No pitching stats available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Home Team Pitchers */}
                <div>
                  <h3 className="font-semibold mb-3">{homeTeam.name} Top Pitchers</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">ERA</TableHead>
                          <TableHead className="text-right">W-L</TableHead>
                          <TableHead className="text-right">WHIP</TableHead>
                          <TableHead className="text-right">K/9</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTopPitchers(homePitchingStats || []).map((stat) => (
                          <TableRow key={stat.id}>
                            <TableCell className="font-medium">
                              {stat.player?.full_name || 'Unknown'}
                              {stat.player?.position && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {stat.player.position}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.era, 2)}</TableCell>
                            <TableCell className="text-right">{stat.wins || 0}-{stat.losses || 0}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.whip, 2)}</TableCell>
                            <TableCell className="text-right font-mono">{formatStat(stat.k_9, 1)}</TableCell>
                          </TableRow>
                        ))}
                        {(!homePitchingStats || homePitchingStats.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No pitching stats available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Prediction Key Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Raw Prediction Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Calculation Factors</h4>
                <div className="text-sm space-y-1 font-mono bg-muted/30 p-3 rounded">
                  {prediction.key_factors ? (
                    Object.entries(prediction.key_factors).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key.replace(/_/g, ' ')}:</span>
                        <span>{typeof value === 'number' ? value.toFixed(3) : String(value)}</span>
                      </div>
                    ))
                  ) : (
                    <div>No key factors available</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Prediction Outputs</h4>
                <div className="text-sm space-y-1 font-mono bg-muted/30 p-3 rounded">
                  <div className="flex justify-between">
                    <span>Home Win Prob:</span>
                    <span>{(prediction.home_win_probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Away Win Prob:</span>
                    <span>{(prediction.away_win_probability * 100).toFixed(2)}%</span>
                  </div>
                  {prediction.predicted_home_score && (
                    <div className="flex justify-between">
                      <span>Predicted Home Score:</span>
                      <span>{prediction.predicted_home_score}</span>
                    </div>
                  )}
                  {prediction.predicted_away_score && (
                    <div className="flex justify-between">
                      <span>Predicted Away Score:</span>
                      <span>{prediction.predicted_away_score}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PredictionDataTab;