import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import GameSelector from '@/components/GameSelector';
import PredictionCard from '@/components/PredictionCard';
import { useGames } from '@/hooks/useGames';
import { useGamePrediction } from '@/hooks/usePredictions';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Calendar, Target, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SimpleModelTest: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  
  // Use yesterday's date for testing
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const testDate = yesterday.toISOString().split('T')[0];
  
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(() => {
    const gameId = searchParams.get('game');
    return gameId ? parseInt(gameId, 10) : undefined;
  });

  const { data: games, refetch: refetchGames } = useGames(testDate);
  const { data: prediction, isLoading: predictionLoading } = useGamePrediction(selectedGameId || 0);

  // Update URL when game selection changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedGameId) {
      params.set('game', selectedGameId.toString());
    }
    setSearchParams(params);
  }, [selectedGameId, setSearchParams]);

  const runFullModelTest = async () => {
    console.log('🚀 Starting full model test...');
    setTestRunning(true);
    setTestResults(null);

    try {
      console.log('📡 Invoking simple-model-test function...');
      const { data, error } = await supabase.functions.invoke('simple-model-test');

      console.log('📊 Function response:', { data, error });

      if (error) {
        console.error('❌ Function error:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ No data returned from function');
        throw new Error('No response data from simple-model-test function');
      }

      console.log('✅ Function completed successfully:', data);
      setTestResults(data);
      
      if (data.success) {
        toast({
          title: "Model Test Completed",
          description: `Tested ${data.steps.analysis?.gamesWithPredictions || 0} games for ${data.testDate}`,
        });
        
        // Refresh games to show updated predictions
        console.log('🔄 Refreshing games data...');
        refetchGames();
      } else {
        toast({
          title: "Model Test Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('💥 Model test error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      toast({
        title: "Test Error",
        description: error.message || "Failed to run model test",
        variant: "destructive"
      });
    } finally {
      console.log('🏁 Test completed, setting testRunning to false');
      setTestRunning(false);
    }
  };

  const selectedGame = games?.find(game => game.game_id === selectedGameId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Target className="h-8 w-8" />
            Model Testing - Yesterday's Games
          </h1>
          <p className="text-xl text-muted-foreground">
            Test model performance using confirmed lineups from {testDate}
          </p>
        </div>

        {/* Test Control Panel */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Full Model Test</h3>
                <p className="text-sm text-muted-foreground">
                  Run complete test: ingest schedule, lineups, generate predictions, and analyze results for {testDate}
                </p>
                {!games || games.length === 0 ? (
                  <p className="text-sm text-yellow-600 font-medium">
                    ⚠️ No games found for {testDate}. Click "Run Full Test" to fetch and populate yesterday's schedule.
                  </p>
                ) : null}
              </div>
              <Button 
                onClick={runFullModelTest}
                disabled={testRunning}
                className="flex items-center gap-2"
                size="lg"
              >
                {testRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  'Run Full Test'
                )}
              </Button>
            </div>
            
            {testResults && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {testResults.steps?.analysis?.gamesWithPredictions || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Games Tested</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.steps?.analysis?.accuracy || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.steps?.analysis?.avgConfidence || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Confidence</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {testResults.steps?.analysis?.avgScoreError || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Score Error</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Selection - Modified to use yesterday's date */}
          <div className="lg:col-span-1">
            <GameSelector
              selectedDate={testDate}
              onDateChange={() => {}} // Disabled date change for testing
              onGameSelect={setSelectedGameId}
              selectedGameId={selectedGameId}
            />
          </div>

          {/* Prediction Display - Identical to main model */}
          <div className="lg:col-span-2">
            {!selectedGameId ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Select a Game</h3>
                  <p className="text-muted-foreground">
                    Choose a game from yesterday's schedule to view test predictions
                  </p>
                </CardContent>
              </Card>
            ) : predictionLoading ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold mb-2">Loading Prediction...</h3>
                  <p className="text-muted-foreground">
                    Fetching test prediction for the selected game
                  </p>
                </CardContent>
              </Card>
            ) : !prediction ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Test Prediction Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Test prediction hasn't been generated for this game yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Run the full model test to generate predictions for all games
                  </p>
                </CardContent>
              </Card>
            ) : selectedGame ? (
              <PredictionCard
                prediction={prediction}
                homeTeam={selectedGame.home_team}
                awayTeam={selectedGame.away_team}
                gameTime={selectedGame.game_time}
              />
            ) : null}
          </div>
        </div>

      </main>
    </div>
  );
};

export default SimpleModelTest;