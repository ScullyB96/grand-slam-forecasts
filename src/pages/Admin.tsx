
import React, { useState } from 'react';
import Header from '@/components/Header';
import { useGames } from '@/hooks/useGames';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, Database, Calendar, Users, Activity, BarChart3, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGameLineups } from '@/hooks/useGameLineups';
import { useIngestStatcastData, useIngestGameFeed } from '@/hooks/useStatcastData';

const Admin = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [testGameId, setTestGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: games, refetch: refetchGames } = useGames(selectedDate);
  const { data: testLineups, refetch: refetchLineups } = useGameLineups(testGameId || 0);
  const { toast } = useToast();
  
  // Statcast ingestion hooks
  const ingestStatcast = useIngestStatcastData();
  const ingestGameFeed = useIngestGameFeed();

  const handleFetchSchedule = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching schedule for:', selectedDate);
      
      const { data, error } = await supabase.functions.invoke('fetch-schedule', {
        body: { date: selectedDate }
      });
      
      if (error) throw error;

      toast({
        title: "Schedule Fetched",
        description: `Found ${data?.gamesProcessed || 0} games for ${selectedDate}`,
      });

      refetchGames();
    } catch (error) {
      console.error('Schedule fetch error:', error);
      toast({
        title: "Schedule Fetch Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchLineups = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching lineups for:', selectedDate);
      
      const { data, error } = await supabase.functions.invoke('ingest-lineups', {
        body: { date: selectedDate, force: true }
      });
      
      if (error) throw error;

      toast({
        title: "Lineups Fetched",
        description: `Processed ${data?.games_processed || 0} games`,
      });

      if (testGameId) {
        refetchLineups();
      }
    } catch (error) {
      console.error('Lineup fetch error:', error);
      toast({
        title: "Lineup Fetch Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testGame = games?.find(g => g.game_id === testGameId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Admin Panel - Simplified
          </h1>
          <p className="text-xl text-muted-foreground">
            Test MLB data ingestion and verify game information
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Target Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded-md w-full"
                />
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleFetchSchedule}
                  disabled={isLoading}
                  className="w-full"
                  variant="default"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Fetch MLB Schedule
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleFetchLineups}
                  disabled={isLoading || !games?.length}
                  className="w-full"
                  variant="secondary"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Fetch Lineups
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Statcast Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Statcast Data Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Enhanced Monte Carlo simulation with real 2025 Statcast metrics
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    ingestStatcast.mutate({ season: 2025 });
                    toast({
                      title: "Statcast Ingestion Started",
                      description: "Fetching 2025 player Statcast metrics...",
                    });
                  }}
                  disabled={ingestStatcast.isPending}
                  className="w-full"
                  variant="default"
                >
                  {ingestStatcast.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Ingesting Statcast...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Ingest Player Statcast
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    const gameIds = games?.map(g => g.game_id) || [];
                    if (gameIds.length > 0) {
                      ingestGameFeed.mutate({ gameIds });
                      toast({
                        title: "Game Feed Ingestion Started",
                        description: `Processing ${gameIds.length} games for pitch/hit data...`,
                      });
                    }
                  }}
                  disabled={ingestGameFeed.isPending || !games?.length}
                  className="w-full"
                  variant="secondary"
                >
                  {ingestGameFeed.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing Games...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Ingest Game Feeds
                    </>
                  )}
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke('scheduled-statcast-ingestion');
                      if (error) throw error;
                      toast({
                        title: "Full Pipeline Triggered",
                        description: "Running complete Statcast ETL pipeline...",
                      });
                    } catch (error) {
                      toast({
                        title: "Pipeline Failed",
                        description: error instanceof Error ? error.message : "Unknown error",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Full Pipeline
                </Button>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Pipeline includes: Player metrics → Game feeds → Prediction refresh
              </div>
            </CardContent>
          </Card>

          {/* Game Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Game Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {games && games.length > 0 ? (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Found {games.length} games for {selectedDate}
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {games.map((game) => (
                        <div
                          key={game.game_id}
                          className={`p-2 border rounded cursor-pointer transition-colors ${
                            testGameId === game.game_id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setTestGameId(game.game_id)}
                        >
                          <div className="text-sm font-medium">
                            {game.away_team?.abbreviation} @ {game.home_team?.abbreviation}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Game ID: {game.game_id} | {game.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No games found for {selectedDate}</p>
                  <p className="text-sm">Click "Fetch MLB Schedule" to load games</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Results */}
          {testGame && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  Testing: {testGame.away_team?.name} @ {testGame.home_team?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Game ID</div>
                    <div className="font-medium">{testGame.game_id}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="font-medium capitalize">{testGame.status}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Venue</div>
                    <div className="font-medium">{testGame.venue_name || 'N/A'}</div>
                  </div>
                </div>

                {/* Lineup Test Results */}
                <div className="border rounded p-4">
                  <h4 className="font-medium mb-3">Lineup Data Test</h4>
                  {testLineups && testLineups.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm text-green-600 font-medium">
                        ✅ Found {testLineups.length} lineup entries
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Away Team Lineups */}
                        <div>
                          <div className="font-medium text-sm mb-2">
                            {testGame.away_team?.name} ({testGame.away_team?.abbreviation})
                          </div>
                          {testLineups
                            .filter(l => l.team_id === testGame.away_team_id)
                            .map(lineup => (
                              <div key={lineup.id} className="text-xs p-2 bg-muted/50 rounded mb-1">
                                <span className="font-medium">{lineup.player_name}</span>
                                <span className="text-muted-foreground ml-2">
                                  {lineup.position} • {lineup.lineup_type}
                                  {lineup.batting_order && ` • #${lineup.batting_order}`}
                                </span>
                              </div>
                            ))
                          }
                        </div>

                        {/* Home Team Lineups */}
                        <div>
                          <div className="font-medium text-sm mb-2">
                            {testGame.home_team?.name} ({testGame.home_team?.abbreviation})
                          </div>
                          {testLineups
                            .filter(l => l.team_id === testGame.home_team_id)
                            .map(lineup => (
                              <div key={lineup.id} className="text-xs p-2 bg-muted/50 rounded mb-1">
                                <span className="font-medium">{lineup.player_name}</span>
                                <span className="text-muted-foreground ml-2">
                                  {lineup.position} • {lineup.lineup_type}
                                  {lineup.batting_order && ` • #${lineup.batting_order}`}
                                </span>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-orange-600">
                      ⚠️ No lineup data found for this game. Click "Fetch Lineups" to try loading data.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
