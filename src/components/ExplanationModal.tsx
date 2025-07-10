
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Home, 
  Target, 
  TrendingUp, 
  Cloud, 
  Building2,
  BarChart3,
  Info
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: GamePrediction;
  homeTeam: Team;
  awayTeam: Team;
}

const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  prediction,
  homeTeam,
  awayTeam
}) => {
  const formatProbability = (prob: number) => {
    return (prob * 100).toFixed(2);
  };

  const formatDecimal = (num: number) => {
    return num.toFixed(2);
  };

  const getFactorIcon = (factor: string) => {
    switch (factor) {
      case 'home_advantage': return <Home className="h-4 w-4" />;
      case 'pitching_matchup': return <Target className="h-4 w-4" />;
      case 'offensive_edge': return <TrendingUp className="h-4 w-4" />;
      case 'park_factors': return <Building2 className="h-4 w-4" />;
      case 'weather_impact': return <Cloud className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getFactorDescription = (key: string, value: any) => {
    switch (key) {
      case 'home_advantage':
        return value ? 'Home team has significant advantage' : 'Neutral home field impact';
      case 'pitching_matchup':
        return `${value === 'home' ? homeTeam.name : awayTeam.name} has pitching advantage`;
      case 'offensive_edge':
        return `${value === 'home' ? homeTeam.name : awayTeam.name} has offensive advantage`;
      case 'park_factors':
        return `${value.replace('_', ' ')} ballpark affects scoring`;
      case 'weather_impact':
        return `Weather conditions: ${value}`;
      default:
        return `${key}: ${value}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Prediction Analysis: {awayTeam.abbreviation} @ {homeTeam.abbreviation}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Win Probability Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Win Probability Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{homeTeam.name}</span>
                    <span className="font-semibold">
                      {formatProbability(prediction.home_win_probability)}%
                    </span>
                  </div>
                  <Progress 
                    value={prediction.home_win_probability * 100} 
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{awayTeam.name}</span>
                    <span className="font-semibold">
                      {formatProbability(prediction.away_win_probability)}%
                    </span>
                  </div>
                  <Progress 
                    value={prediction.away_win_probability * 100} 
                    className="h-2"
                  />
                </div>
              </div>

              {prediction.confidence_score && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Prediction Confidence</span>
                    <Badge variant="outline">
                      {Math.round(prediction.confidence_score * 100)}%
                    </Badge>
                  </div>
                  <Progress 
                    value={prediction.confidence_score * 100} 
                    className="h-2 mt-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Prediction */}
          {prediction.predicted_home_score !== undefined && prediction.predicted_away_score !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Score Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold mb-2">
                    {awayTeam.abbreviation} {prediction.predicted_away_score} - {prediction.predicted_home_score} {homeTeam.abbreviation}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Based on 10,000 Monte Carlo simulations
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Over/Under Analysis */}
          {prediction.over_under_line && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Over/Under Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Total Runs Line:</span>
                  <span className="font-semibold">{prediction.over_under_line}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Over Probability:</span>
                    <span className="font-medium">
                      {formatProbability(prediction.over_probability || 0.5)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Under Probability:</span>
                    <span className="font-medium">
                      {formatProbability(prediction.under_probability || 0.5)}%
                    </span>
                  </div>
                </div>

                <Progress 
                  value={(prediction.over_probability || 0.5) * 100} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground text-center">
                  Over ← → Under
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Factors */}
          {prediction.key_factors && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(prediction.key_factors).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="mt-0.5">
                          {getFactorIcon(key)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium capitalize">
                            {key.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getFactorDescription(key, value)}
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Methodology</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Predictions are generated using advanced statistical models that combine:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Team offensive and defensive statistics</li>
                <li>Park factors and ballpark characteristics</li>
                <li>Weather conditions and environmental factors</li>
                <li>Historical matchup data and trends</li>
                <li>Monte Carlo simulation (10,000 iterations)</li>
              </ul>
              <p className="mt-3">
                Confidence levels reflect the statistical certainty of the prediction based on 
                team performance differentials and data quality.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExplanationModal;
