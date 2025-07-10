import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  BarChart3,
  Calendar,
  Clock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DataQualityMetrics {
  lineups: {
    total_games: number;
    games_with_lineups: number;
    official_lineups: number;
    mock_lineups: number;
    completeness_score: number;
  };
  predictions: {
    total_predictions: number;
    high_confidence: number;
    avg_confidence: number;
    completeness_score: number;
  };
  player_stats: {
    total_players: number;
    players_with_batting_stats: number;
    players_with_pitching_stats: number;
    completeness_score: number;
  };
  data_freshness: {
    last_lineup_update: string;
    last_prediction_update: string;
    last_stats_update: string;
  };
}

const DataQualityDashboard = () => {
  const { data: qualityMetrics, isLoading } = useQuery({
    queryKey: ['data-quality-metrics'],
    queryFn: async (): Promise<DataQualityMetrics> => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get lineup quality metrics
      const { data: games } = await supabase
        .from('games')
        .select('game_id')
        .eq('game_date', today);
      
      const { data: lineups } = await supabase
        .from('game_lineups')
        .select('game_id, player_name, player_id, created_at')
        .in('game_id', games?.map(g => g.game_id) || []);
      
      // Classify lineups as official or mock
      const officialLineups = lineups?.filter(l => 
        !l.player_name.includes('Player (') && 
        !l.player_name.includes('Mock') &&
        l.player_id < 600000
      ) || [];
      
      const mockLineups = lineups?.filter(l => 
        l.player_name.includes('Player (') || 
        l.player_name.includes('Mock') ||
        l.player_id >= 600000
      ) || [];
      
      // Get prediction metrics
      const { data: predictions } = await supabase
        .from('game_predictions')
        .select('confidence_score, last_updated')
        .in('game_id', games?.map(g => g.game_id) || []);
      
      const highConfidencePredictions = predictions?.filter(p => (p.confidence_score || 0) > 0.75) || [];
      const avgConfidence = predictions?.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / (predictions?.length || 1);
      
      // Get player stats metrics
      const { data: players } = await supabase
        .from('players')
        .select('player_id');
      
      const { data: battingStats } = await supabase
        .from('batting_stats')
        .select('player_id')
        .eq('season', 2024);
      
      const { data: pitchingStats } = await supabase
        .from('pitching_stats')
        .select('player_id')
        .eq('season', 2024);
      
      const uniqueBatters = new Set(battingStats?.map(s => s.player_id)).size;
      const uniquePitchers = new Set(pitchingStats?.map(s => s.player_id)).size;
      
      return {
        lineups: {
          total_games: games?.length || 0,
          games_with_lineups: new Set(lineups?.map(l => l.game_id)).size,
          official_lineups: new Set(officialLineups.map(l => l.game_id)).size,
          mock_lineups: new Set(mockLineups.map(l => l.game_id)).size,
          completeness_score: Math.round((new Set(lineups?.map(l => l.game_id)).size / (games?.length || 1)) * 100)
        },
        predictions: {
          total_predictions: predictions?.length || 0,
          high_confidence: highConfidencePredictions.length,
          avg_confidence: Math.round(avgConfidence * 100),
          completeness_score: Math.round((predictions?.length || 0) / (games?.length || 1) * 100)
        },
        player_stats: {
          total_players: players?.length || 0,
          players_with_batting_stats: uniqueBatters,
          players_with_pitching_stats: uniquePitchers,
          completeness_score: Math.round(((uniqueBatters + uniquePitchers) / ((players?.length || 1) * 2)) * 100)
        },
        data_freshness: {
          last_lineup_update: lineups?.[0]?.created_at || 'Never',
          last_prediction_update: predictions?.[0]?.last_updated || 'Never',
          last_stats_update: 'Unknown'
        }
      };
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Quality Dashboard
        </CardTitle>
        <CardDescription>
          Real-time monitoring of data completeness and quality across all systems
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="lineups">Lineups</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="stats">Player Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Lineup Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{qualityMetrics?.lineups.completeness_score}%</span>
                      <Badge variant={getScoreVariant(qualityMetrics?.lineups.completeness_score || 0)}>
                        {qualityMetrics?.lineups.completeness_score || 0}%
                      </Badge>
                    </div>
                    <Progress value={qualityMetrics?.lineups.completeness_score} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {qualityMetrics?.lineups.games_with_lineups} of {qualityMetrics?.lineups.total_games} games covered
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{qualityMetrics?.predictions.completeness_score}%</span>
                      <Badge variant={getScoreVariant(qualityMetrics?.predictions.completeness_score || 0)}>
                        {qualityMetrics?.predictions.completeness_score || 0}%
                      </Badge>
                    </div>
                    <Progress value={qualityMetrics?.predictions.completeness_score} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Avg confidence: {qualityMetrics?.predictions.avg_confidence}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Player Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{qualityMetrics?.player_stats.completeness_score}%</span>
                      <Badge variant={getScoreVariant(qualityMetrics?.player_stats.completeness_score || 0)}>
                        {qualityMetrics?.player_stats.completeness_score || 0}%
                      </Badge>
                    </div>
                    <Progress value={qualityMetrics?.player_stats.completeness_score} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {qualityMetrics?.player_stats.players_with_batting_stats} batters, {qualityMetrics?.player_stats.players_with_pitching_stats} pitchers
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Quality Alerts */}
            <div className="space-y-2">
              {(qualityMetrics?.lineups.completeness_score || 0) < 60 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Low lineup coverage detected. Consider running the lineup monitor to fetch missing data.
                  </AlertDescription>
                </Alert>
              )}
              
              {(qualityMetrics?.predictions.avg_confidence || 0) < 50 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Low prediction confidence. This may indicate insufficient training data or model issues.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lineups" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{qualityMetrics?.lineups.total_games}</div>
                <div className="text-sm text-muted-foreground">Total Games</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{qualityMetrics?.lineups.official_lineups}</div>
                <div className="text-sm text-muted-foreground">Official Lineups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{qualityMetrics?.lineups.mock_lineups}</div>
                <div className="text-sm text-muted-foreground">Mock Lineups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{qualityMetrics?.lineups.games_with_lineups}</div>
                <div className="text-sm text-muted-foreground">Games Covered</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Data Source Breakdown</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Official MLB Data
                  </span>
                  <span>{qualityMetrics?.lineups.official_lineups} games</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    Mock/Projected Data
                  </span>
                  <span>{qualityMetrics?.lineups.mock_lineups} games</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{qualityMetrics?.predictions.total_predictions}</div>
                <div className="text-sm text-muted-foreground">Total Predictions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{qualityMetrics?.predictions.high_confidence}</div>
                <div className="text-sm text-muted-foreground">High Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{qualityMetrics?.predictions.avg_confidence}%</div>
                <div className="text-sm text-muted-foreground">Avg Confidence</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{qualityMetrics?.player_stats.total_players}</div>
                <div className="text-sm text-muted-foreground">Total Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{qualityMetrics?.player_stats.players_with_batting_stats}</div>
                <div className="text-sm text-muted-foreground">With Batting Stats</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{qualityMetrics?.player_stats.players_with_pitching_stats}</div>
                <div className="text-sm text-muted-foreground">With Pitching Stats</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DataQualityDashboard;