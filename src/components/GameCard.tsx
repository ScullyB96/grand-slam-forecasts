
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface Game {
  id: number;
  game_id: number;
  game_date: string;
  game_time?: string;
  home_team: Team;
  away_team: Team;
  venue_name?: string;
  status: string;
  home_score?: number;
  away_score?: number;
}

interface GamePrediction {
  home_win_probability: number;
  away_win_probability: number;
  confidence_score?: number;
}

interface GameCardProps {
  game: Game;
  prediction?: GamePrediction;
}

const GameCard = ({ game, prediction }: GameCardProps) => {
  const formatTime = (timeString?: string) => {
    if (!timeString) return "TBD";
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'live': return 'bg-green-100 text-green-800';
      case 'final': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{game.away_team.name} @ {game.home_team.name}</CardTitle>
          <Badge className={getStatusColor(game.status)}>
            {game.status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(game.game_time)}</span>
          </div>
          {game.venue_name && (
            <div className="flex items-center space-x-1">
              <MapPin className="h-4 w-4" />
              <span>{game.venue_name}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{game.away_team.abbreviation}</div>
            {game.status === 'final' && (
              <div className="text-3xl font-bold text-foreground mt-1">
                {game.away_score}
              </div>
            )}
            {prediction && (
              <div className="mt-2">
                <div className="text-sm text-muted-foreground">Win Probability</div>
                <div className="text-lg font-semibold">
                  {Math.round(prediction.away_win_probability * 100)}%
                </div>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{game.home_team.abbreviation}</div>
            {game.status === 'final' && (
              <div className="text-3xl font-bold text-foreground mt-1">
                {game.home_score}
              </div>
            )}
            {prediction && (
              <div className="mt-2">
                <div className="text-sm text-muted-foreground">Win Probability</div>
                <div className="text-lg font-semibold">
                  {Math.round(prediction.home_win_probability * 100)}%
                </div>
              </div>
            )}
          </div>
        </div>
        {prediction?.confidence_score && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <Badge variant="secondary">
                {Math.round(prediction.confidence_score * 100)}%
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GameCard;
