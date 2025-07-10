
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Info, Target, Clock } from 'lucide-react';
import { format } from 'date-fns';
import ExplanationModal from './ExplanationModal';

interface GamePrediction {
  id: number;
  game_id: number;
  home_win_probability: number;
  away_win_probability: number;
  predicted_home_score?: number;
  predicted_away_score?: number;
  over_under_line?: number;
  over_probability?: number;
  under_probability?: number;
  confidence_score?: number;
  key_factors?: any;
  prediction_date: string;
}

interface Team {
  name: string;
  abbreviation: string;
}

interface PredictionCardProps {
  prediction: GamePrediction;
  homeTeam: Team;
  awayTeam: Team;
  gameTime?: string;
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  homeTeam,
  awayTeam,
  gameTime
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'secondary';
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'outline';
  };

  const getConfidenceText = (confidence?: number) => {
    if (!confidence) return 'Low';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const formatProbability = (prob: number) => {
    return `${Math.round(prob * 100)}%`;
  };

  const favoredTeam = prediction.home_win_probability > prediction.away_win_probability 
    ? homeTeam 
    : awayTeam;
  
  const favoredProb = Math.max(prediction.home_win_probability, prediction.away_win_probability);

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {awayTeam.abbreviation} @ {homeTeam.abbreviation}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={getConfidenceColor(prediction.confidence_score)}>
                {getConfidenceText(prediction.confidence_score)} Confidence
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {gameTime && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(new Date(`2000-01-01T${gameTime}`), 'h:mm a')}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Win Probabilities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{awayTeam.name}</span>
                {prediction.away_win_probability > prediction.home_win_probability && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div className="text-lg font-semibold">
                {formatProbability(prediction.away_win_probability)}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{homeTeam.name}</span>
                {prediction.home_win_probability > prediction.away_win_probability && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div className="text-lg font-semibold">
                {formatProbability(prediction.home_win_probability)}
              </div>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Favored: {favoredTeam.name} ({formatProbability(favoredProb)})
            </div>
          </div>

          {/* Predicted Scores */}
          {prediction.predicted_home_score !== undefined && prediction.predicted_away_score !== undefined && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Predicted Final Score
              </div>
              <div className="text-center">
                <span className="text-xl font-bold">
                  {awayTeam.abbreviation} {prediction.predicted_away_score} - {prediction.predicted_home_score} {homeTeam.abbreviation}
                </span>
              </div>
            </div>
          )}

          {/* Over/Under */}
          {prediction.over_under_line && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm font-medium mb-2">Over/Under</div>
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-lg font-semibold">{prediction.over_under_line}</div>
                  <div className="text-xs text-muted-foreground">Total Runs</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    Over: {formatProbability(prediction.over_probability || 0.5)}
                  </div>
                  <div className="text-sm">
                    Under: {formatProbability(prediction.under_probability || 0.5)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Factors Preview */}
          {prediction.key_factors && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Key Factors</div>
              <div className="flex flex-wrap gap-1">
                {prediction.key_factors.home_advantage && (
                  <Badge variant="outline" className="text-xs">Home Field</Badge>
                )}
                {prediction.key_factors.pitching_matchup && (
                  <Badge variant="outline" className="text-xs">
                    Pitching Edge: {prediction.key_factors.pitching_matchup}
                  </Badge>
                )}
                {prediction.key_factors.park_factors && (
                  <Badge variant="outline" className="text-xs">
                    {prediction.key_factors.park_factors} Park
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Updated: {format(new Date(prediction.prediction_date), 'MMM dd, h:mm a')}
          </div>
        </CardContent>
      </Card>

      <ExplanationModal
        isOpen={showExplanation}
        onClose={() => setShowExplanation(false)}
        prediction={prediction}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
      />
    </>
  );
};

export default PredictionCard;
