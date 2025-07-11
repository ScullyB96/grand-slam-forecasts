import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMonteCarloSimulation, MonteCarloResult } from '@/hooks/useMonteCarloSimulation';
import { Calculator, Play, TrendingUp, BarChart3, Zap, Target, Info } from 'lucide-react';

interface MonteCarloSimulationCardProps {
  gameId: number;
  homeTeam: { name: string; abbreviation: string };
  awayTeam: { name: string; abbreviation: string };
}

const MonteCarloSimulationCard: React.FC<MonteCarloSimulationCardProps> = ({
  gameId,
  homeTeam,
  awayTeam
}) => {
  const [iterations, setIterations] = useState(10000);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const { toast } = useToast();
  
  const { mutate: runSimulation, isPending, error } = useMonteCarloSimulation();

  const handleRunSimulation = () => {
    if (iterations < 1000 || iterations > 50000) {
      toast({
        title: "Invalid iterations",
        description: "Please enter between 1,000 and 50,000 iterations",
        variant: "destructive"
      });
      return;
    }

    runSimulation(
      { gameId, iterations },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({
            title: "Simulation Complete!",
            description: `Generated ${data.iterations.toLocaleString()} game simulations`
          });
        },
        onError: (error) => {
          toast({
            title: "Simulation Failed",
            description: error.message,
            variant: "destructive"
          });
        }
      }
    );
  };

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(1)}%`;
  const formatDecimal = (num: number) => num.toFixed(1);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Monte Carlo Simulation
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {awayTeam.abbreviation} @ {homeTeam.abbreviation} - Advanced statistical modeling
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Simulation Controls */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iterations">Simulation Iterations</Label>
              <Input
                id="iterations"
                type="number"
                min="1000"
                max="50000"
                step="1000"
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value) || 10000)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                More iterations = higher accuracy (1K-50K)
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <Button 
                onClick={handleRunSimulation}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
            </div>
          </div>

          {isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Running Monte Carlo simulation...</span>
                <span>{iterations.toLocaleString()} iterations</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
              <p className="text-sm font-medium text-destructive">
                Simulation Failed - Real Data Required
              </p>
              <p className="text-sm text-destructive/80">
                {error.message}
              </p>
              {(error.message.includes('INSUFFICIENT_PITCHING_DATA') || error.message.includes('INSUFFICIENT_BATTING_DATA')) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    🎯 Fix Required: Execute Real Data Plan
                  </p>
                  <p className="text-xs text-blue-700">
                    Go to the Admin page and click "Implement Real Data Plan (2025 Rosters + 2024 Stats)" to ingest the necessary MLB data for accurate predictions.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {result && (
          <>
            <Separator />
            
            {/* Simulation Results */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Simulation Results</h3>
                <Badge variant="default" className="bg-green-600">
                  {result.iterations.toLocaleString()} simulations
                </Badge>
              </div>

              {/* Win Probabilities */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Win Probabilities</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 border-l-4 border-l-blue-500">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-blue-700">{awayTeam.name}</div>
                      <div className="text-2xl font-bold">
                        {formatProbability(result.simulation_stats.away_win_probability)}
                      </div>
                      <Progress 
                        value={result.simulation_stats.away_win_probability * 100} 
                        className="h-2"
                      />
                    </div>
                  </Card>

                  <Card className="p-4 border-l-4 border-l-green-500">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-green-700">{homeTeam.name}</div>
                      <div className="text-2xl font-bold">
                        {formatProbability(result.simulation_stats.home_win_probability)}
                      </div>
                      <Progress 
                        value={result.simulation_stats.home_win_probability * 100} 
                        className="h-2"
                      />
                    </div>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Score Predictions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Predicted Final Score</h4>
                </div>
                
                <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-indigo-700">
                      {awayTeam.abbreviation} {result.simulation_stats.predicted_away_score} - {result.simulation_stats.predicted_home_score} {homeTeam.abbreviation}
                    </div>
                    <div className="text-sm text-indigo-600">
                      Average of {result.simulation_stats.sample_size.toLocaleString()} simulated games
                    </div>
                    <div className="text-sm text-indigo-600">
                      Total Runs: {formatDecimal(result.simulation_stats.predicted_total_runs)}
                    </div>
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Over/Under Analysis */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Over/Under Analysis</h4>
                </div>
                
                <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-700">
                        Total: {result.simulation_stats.over_under_line} runs
                      </div>
                      <div className="text-sm text-orange-600">
                        Projected: {formatDecimal(result.simulation_stats.predicted_total_runs)} runs
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-white/60 rounded">
                        <div className="text-sm font-medium">Over</div>
                        <div className="text-xl font-bold text-green-600">
                          {formatProbability(result.simulation_stats.over_probability)}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-white/60 rounded">
                        <div className="text-sm font-medium">Under</div>
                        <div className="text-xl font-bold text-red-600">
                          {formatProbability(result.simulation_stats.under_probability)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Key Insights - NEW */}
              {result.key_insights && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Key Insights</h4>
                  </div>
                  
                  <div className="space-y-2">
                    {result.key_insights.pitching_matchup && (
                      <Card className="p-3 border-l-4 border-l-blue-500">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-blue-700">Pitching Matchup</div>
                          <div className="text-sm">{result.key_insights.pitching_matchup}</div>
                        </div>
                      </Card>
                    )}
                    
                    {result.key_insights.offensive_edge && (
                      <Card className="p-3 border-l-4 border-l-green-500">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-green-700">Offensive Analysis</div>
                          <div className="text-sm">{result.key_insights.offensive_edge}</div>
                        </div>
                      </Card>
                    )}
                    
                    {result.key_insights.environmental_impact && (
                      <Card className="p-3 border-l-4 border-l-orange-500">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-orange-700">Environmental Impact</div>
                          <div className="text-sm">{result.key_insights.environmental_impact}</div>
                        </div>
                      </Card>
                    )}

                    {result.key_insights.confidence_drivers && Array.isArray(result.key_insights.confidence_drivers) && result.key_insights.confidence_drivers.length > 0 && (
                      <Card className="p-3 border-l-4 border-l-purple-500">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-purple-700">Confidence Drivers</div>
                          <div className="flex flex-wrap gap-1">
                            {result.key_insights.confidence_drivers.map((factor: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Simulation Factors - Enhanced */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Simulation Parameters</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Environmental Factors</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Park Factor:</span>
                          <span>{formatDecimal(result.factors.park_factor)}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Weather Impact:</span>
                          <span>{formatDecimal(result.factors.weather_impact)}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Home Advantage:</span>
                          <span>{formatDecimal(result.factors.home_advantage)}x</span>
                        </div>
                        {result.factors.data_quality && (
                          <div className="flex justify-between">
                            <span>Data Quality:</span>
                            <span>{formatProbability(result.factors.data_quality)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Model Performance</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span>{formatProbability(result.simulation_stats.confidence_score)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sample Size:</span>
                          <span>{result.simulation_stats.sample_size.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Method:</span>
                          <span>Statcast Monte Carlo</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                Simulation completed at {new Date(result.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MonteCarloSimulationCard;