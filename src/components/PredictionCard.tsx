import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Info, Target, Clock, Calculator, BarChart3, Trophy, Percent, Database, Users } from 'lucide-react';
import ExplanationModal from './ExplanationModal';
import PredictionDataTab from './PredictionDataTab';
import LineupDataTab from './LineupDataTab';

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

interface TeamWithId extends Team {
  id: number;
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  homeTeam,
  awayTeam,
  gameTime
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeTab, setActiveTab] = useState('prediction');

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
    return `${(prob * 100).toFixed(2)}%`;
  };

  const formatDecimal = (num: number) => {
    return num.toFixed(2);
  };

  const getWinProbabilityGradient = (prob: number) => {
    const percentage = Math.round(prob * 100);
    if (percentage >= 60) return 'from-green-500 to-green-600';
    if (percentage >= 55) return 'from-emerald-500 to-emerald-600';
    if (percentage >= 50) return 'from-blue-500 to-blue-600';
    if (percentage >= 45) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  const formatGameTime = (timeString?: string) => {
    if (!timeString) return 'TBD';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const formatPredictionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  const favoredTeam = prediction.home_win_probability > prediction.away_win_probability
    ? homeTeam
    : awayTeam;

  const favoredProb = Math.max(prediction.home_win_probability, prediction.away_win_probability);
  
  // Extract calculation factors
  const keyFactors = prediction.key_factors || {};
  const homeWinPct = keyFactors.home_win_pct || 0;
  const awayWinPct = keyFactors.away_win_pct || 0;
  const homeRunsPerGame = keyFactors.home_runs_per_game || 0;
  const awayRunsPerGame = keyFactors.away_runs_per_game || 0;

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
              {formatGameTime(gameTime)} EST
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prediction" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Prediction
              </TabsTrigger>
              <TabsTrigger value="lineups" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Lineups
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                All Data
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="prediction" className="space-y-6 mt-6">
          {/* Win Probabilities with Visual Progress */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Win Probabilities</h3>
            </div>
            
            <div className="space-y-4">
              {/* Away Team */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{awayTeam.name}</span>
                    {prediction.away_win_probability > prediction.home_win_probability && (
                      <Badge variant="default" className="text-xs">FAVORED</Badge>
                    )}
                  </div>
                  <div className="text-xl font-bold">
                    {formatProbability(prediction.away_win_probability)}
                  </div>
                </div>
                <Progress 
                  value={prediction.away_win_probability * 100} 
                  className="h-3"
                />
              </div>

              {/* Home Team */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{homeTeam.name}</span>
                    {prediction.home_win_probability > prediction.away_win_probability && (
                      <Badge variant="default" className="text-xs">FAVORED</Badge>
                    )}
                  </div>
                  <div className="text-xl font-bold">
                    {formatProbability(prediction.home_win_probability)}
                  </div>
                </div>
                <Progress 
                  value={prediction.home_win_probability * 100} 
                  className="h-3"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Calculation Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Calculation Breakdown</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3 border-l-4 border-l-blue-500">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-blue-700">{awayTeam.abbreviation} Stats</div>
                  {awayWinPct > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Win %:</span>
                      <span className="font-mono">{formatDecimal(awayWinPct * 100)}%</span>
                    </div>
                  )}
                  {awayRunsPerGame > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Runs/Game:</span>
                      <span className="font-mono">{formatDecimal(awayRunsPerGame)}</span>
                    </div>
                  )}
                  {keyFactors.away_team_record && (
                    <div className="flex justify-between text-sm">
                      <span>Record:</span>
                      <span className="font-mono">{keyFactors.away_team_record}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-3 border-l-4 border-l-green-500">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-green-700">{homeTeam.abbreviation} Stats</div>
                  {homeWinPct > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Win %:</span>
                      <span className="font-mono">{formatDecimal(homeWinPct * 100)}%</span>
                    </div>
                  )}
                  {homeRunsPerGame > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Runs/Game:</span>
                      <span className="font-mono">{formatDecimal(homeRunsPerGame)}</span>
                    </div>
                  )}
                  {keyFactors.home_team_record && (
                    <div className="flex justify-between text-sm">
                      <span>Record:</span>
                      <span className="font-mono">{keyFactors.home_team_record}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Algorithm Components */}
            <Card className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
              <div className="space-y-2">
                <div className="text-sm font-medium text-purple-700">Algorithm Components</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-medium">Team Strength</div>
                    <div className="text-purple-600">60% weight</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Home Advantage</div>
                    <div className="text-purple-600">40% weight</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Confidence</div>
                    <div className="text-purple-600">{formatDecimal((prediction.confidence_score || 0) * 100)}%</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Separator />

          {/* Predicted Scores */}
          {prediction.predicted_home_score !== undefined && prediction.predicted_away_score !== undefined && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Score Prediction</h3>
              </div>
              
              <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-indigo-700">
                    {awayTeam.abbreviation} {prediction.predicted_away_score} - {prediction.predicted_home_score} {homeTeam.abbreviation}
                  </div>
                  <div className="text-sm text-indigo-600">
                    Based on team offensive averages + variance
                  </div>
                </div>
              </Card>

              {/* Score Calculation Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-sm space-y-1 p-2 bg-muted/30 rounded">
                  <div className="font-medium">{awayTeam.abbreviation} Score Calc:</div>
                  <div className="text-xs text-muted-foreground">
                    Base: {formatDecimal(awayRunsPerGame)} runs/game
                  </div>
                  <div className="text-xs text-muted-foreground">
                    + Random variance: ±1 run
                  </div>
                </div>
                <div className="text-sm space-y-1 p-2 bg-muted/30 rounded">
                  <div className="font-medium">{homeTeam.abbreviation} Score Calc:</div>
                  <div className="text-xs text-muted-foreground">
                    Base: {formatDecimal(homeRunsPerGame)} runs/game
                  </div>
                  <div className="text-xs text-muted-foreground">
                    + Home field boost: +3% advantage
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Over/Under */}
          {prediction.over_under_line && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Over/Under Analysis</h3>
                </div>
                
                <Card className="p-3 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-700">
                        Total: {prediction.over_under_line} runs
                      </div>
                      <div className="text-sm text-orange-600">
                        Projected: {(prediction.predicted_home_score || 0) + (prediction.predicted_away_score || 0)} runs
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-white/60 rounded">
                        <div className="text-sm font-medium">Over</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatProbability(prediction.over_probability || 0.5)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded">
                        <div className="text-sm font-medium">Under</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatProbability(prediction.under_probability || 0.5)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}

          <Separator />

          {/* Confidence & Methodology */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Model Confidence</h3>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <div>
                <div className="font-medium text-green-700">
                  {getConfidenceText(prediction.confidence_score)}
                </div>
                <div className="text-sm text-green-600">
                  Based on data quality & team differential
                </div>
              </div>
              <div className="text-2xl font-bold text-green-700">
                {formatDecimal((prediction.confidence_score || 0) * 100)}%
              </div>
            </div>
          </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between pt-2 border-t">
                <span>Updated: {formatPredictionDate(prediction.prediction_date)} EST</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowExplanation(true)}
                  className="text-xs h-6"
                >
                  View Details
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="lineups" className="mt-6">
              <LineupDataTab 
                gameId={prediction.game_id}
                homeTeam={homeTeam as TeamWithId}
                awayTeam={awayTeam as TeamWithId}
                prediction={prediction}
              />
            </TabsContent>
            
            <TabsContent value="data" className="mt-6">
              <PredictionDataTab 
                gameId={prediction.game_id}
                homeTeam={homeTeam as TeamWithId}
                awayTeam={awayTeam as TeamWithId}
                prediction={prediction}
              />
            </TabsContent>
          </Tabs>
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