
import React, { useState } from 'react';
import { useGames, useFetchSchedule } from '@/hooks/useGames';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Game {
  id: number;
  game_id: number;
  game_date: string;
  game_time?: string;
  home_team: {
    name: string;
    abbreviation: string;
  };
  away_team: {
    name: string;
    abbreviation: string;
  };
  status: string;
}

interface GameSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onGameSelect: (gameId: number) => void;
  selectedGameId?: number;
}

const GameSelector: React.FC<GameSelectorProps> = ({
  selectedDate,
  onDateChange,
  onGameSelect,
  selectedGameId
}) => {
  const { data: games, isLoading, error, refetch } = useGames(selectedDate);
  const { refetch: triggerFetch, isFetching: isFetching } = useFetchSchedule();
  const [generatingPredictions, setGeneratingPredictions] = useState(false);
  const { toast } = useToast();

  const handleFetchSchedule = async () => {
    try {
      console.log('Triggering schedule fetch...');
      const result = await triggerFetch();
      
      if (result.data?.success) {
        toast({
          title: "Schedule Updated",
          description: `Fetched ${result.data.gamesProcessed} games for ${selectedDate}`
        });
        
        // Refresh games after fetch
        setTimeout(() => {
          refetch();
        }, 1000);
      } else {
        throw new Error(result.data?.error || 'Fetch failed');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Fetch Failed",
        description: "Failed to fetch schedule from MLB API. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleGeneratePredictions = async () => {
    if (!games || games.length === 0) return;

    setGeneratingPredictions(true);
    try {
      const gameIds = games.map(game => game.game_id);
      
      const { error } = await supabase.functions.invoke('generate-predictions', {
        body: { game_ids: gameIds }
      });

      if (error) throw error;

      toast({
        title: "Predictions Generated",
        description: `Generated predictions for ${games.length} games`
      });

      // Refresh the predictions data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error generating predictions:', error);
      toast({
        title: "Error",
        description: "Failed to generate predictions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGeneratingPredictions(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    // Parse date as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatGameTime = (game: Game) => {
    if (!game.game_time) return 'TBD';
    
    // Create a date object with today's date and the game time
    const today = new Date();
    const [hours, minutes] = game.game_time.split(':').map(Number);
    const gameDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    
    // Format in EST timezone
    return gameDateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Calendar className="h-5 w-5" />
            Error Loading Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Failed to load games: {error.message}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={handleFetchSchedule} disabled={isFetching}>
              <Download className="h-4 w-4 mr-2" />
              {isFetching ? 'Fetching...' : 'Fetch Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Loading Games...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Games for {formatDisplayDate(selectedDate)}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFetchSchedule}
            disabled={isFetching}
          >
            <Download className="h-4 w-4 mr-2" />
            {isFetching ? 'Fetching...' : 'Fetch Schedule'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleGeneratePredictions}
            disabled={generatingPredictions || !games?.length}
          >
            {generatingPredictions ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Predictions'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 border rounded-md w-full max-w-xs"
          />
        </div>
        
        {!games || games.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-muted-foreground">
              No games scheduled for this date
            </div>
            <div className="text-sm text-muted-foreground">
              Try fetching the latest schedule from MLB
            </div>
            <Button 
              variant="outline" 
              onClick={handleFetchSchedule}
              disabled={isFetching}
              className="mt-2"
            >
              <Download className="h-4 w-4 mr-2" />
              {isFetching ? 'Fetching Schedule...' : 'Fetch MLB Schedule'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {games.map((game) => (
              <div
                key={game.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedGameId === game.game_id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => onGameSelect(game.game_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium">
                      {game.away_team.abbreviation} @ {game.home_team.abbreviation}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatGameTime(game)} EST
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {game.status}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {game.away_team.name} at {game.home_team.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GameSelector;
