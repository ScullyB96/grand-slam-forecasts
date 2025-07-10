
import React, { useState } from 'react';
import { useGames } from '@/hooks/useGames';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
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
  const { data: games, isLoading, refetch } = useGames(selectedDate);
  const [generatingPredictions, setGeneratingPredictions] = useState(false);
  const { toast } = useToast();

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

  const formatGameTime = (game: Game) => {
    if (!game.game_time) return '';
    return format(new Date(`2000-01-01T${game.game_time}`), 'h:mm a');
  };

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
          Games for {format(new Date(selectedDate), 'MMM dd, yyyy')}
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
          <div className="text-center py-8 text-muted-foreground">
            No games scheduled for this date
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
                      {formatGameTime(game)}
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
