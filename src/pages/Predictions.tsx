
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import GameSelector from '@/components/GameSelector';
import PredictionCard from '@/components/PredictionCard';
import { useGames } from '@/hooks/useGames';
import { useGamePrediction } from '@/hooks/usePredictions';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Calendar } from 'lucide-react';

const Predictions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    return searchParams.get('date') || new Date().toISOString().split('T')[0];
  });
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(() => {
    const gameId = searchParams.get('game');
    return gameId ? parseInt(gameId, 10) : undefined;
  });

  const { data: games } = useGames(selectedDate);
  const { data: prediction, isLoading: predictionLoading } = useGamePrediction(selectedGameId || 0);

  // Update URL when selections change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    if (selectedGameId) {
      params.set('game', selectedGameId.toString());
    }
    setSearchParams(params);
  }, [selectedDate, selectedGameId, setSearchParams]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedGameId(undefined); // Clear game selection when date changes
  };

  const selectedGame = games?.find(game => game.game_id === selectedGameId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <TrendingUp className="h-8 w-8" />
            MLB Predictions
          </h1>
          <p className="text-xl text-muted-foreground">
            Advanced statistical predictions powered by machine learning
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Selection */}
          <div className="lg:col-span-1">
            <GameSelector
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              onGameSelect={setSelectedGameId}
              selectedGameId={selectedGameId}
            />
          </div>

          {/* Prediction Display */}
          <div className="lg:col-span-2">
            {!selectedGameId ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Select a Game</h3>
                  <p className="text-muted-foreground">
                    Choose a game from the left to view detailed predictions
                  </p>
                </CardContent>
              </Card>
            ) : predictionLoading ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold mb-2">Loading Prediction...</h3>
                  <p className="text-muted-foreground">
                    Fetching analysis for the selected game
                  </p>
                </CardContent>
              </Card>
            ) : !prediction ? (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Prediction Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Prediction hasn't been generated for this game yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Try generating predictions using the button in the game selector
                  </p>
                </CardContent>
              </Card>
            ) : selectedGame ? (
              <PredictionCard
                prediction={prediction}
                homeTeam={selectedGame.home_team}
                awayTeam={selectedGame.away_team}
                gameTime={selectedGame.game_time}
                gameId={selectedGame.game_id}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Predictions;
