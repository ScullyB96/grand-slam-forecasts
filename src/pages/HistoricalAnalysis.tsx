import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Calendar, Database, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackfillResult {
  success: boolean;
  jobId?: number;
  totalDays: number;
  processedDays: number;
  scheduleSuccess: number;
  lineupSuccess: number;
  predictionSuccess: number;
  errors: string[];
}

interface AnalysisResult {
  success: boolean;
  total_games: number;
  games_with_predictions: number;
  correct_predictions: number;
  accuracy_percentage: number;
  avg_confidence_score: number;
  avg_score_error: number;
  details?: any[];
}

const HistoricalAnalysis: React.FC = () => {
  const { toast } = useToast();
  const [backfillForm, setBackfillForm] = useState({
    startDate: '2025-07-09',
    endDate: '2025-07-09',
    includeLineups: true,
    includePredictions: true,
    force: false
  });
  
  const [analysisForm, setAnalysisForm] = useState({
    startDate: '2025-07-09',
    endDate: '2025-07-09',
    includeDetails: true
  });

  const [backfillLoading, setBackfillLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleBackfill = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('historical-backfill', {
        body: backfillForm
      });

      if (error) {
        throw error;
      }

      setBackfillResult(data);
      
      if (data.success) {
        toast({
          title: "Backfill Completed",
          description: `Processed ${data.processedDays}/${data.totalDays} days successfully`,
        });
      } else {
        toast({
          title: "Backfill Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast({
        title: "Backfill Error",
        description: error.message || "Failed to start backfill process",
        variant: "destructive"
      });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('prediction-analysis', {
        body: analysisForm
      });

      if (error) {
        throw error;
      }

      setAnalysisResult(data);
      
      if (data.success) {
        toast({
          title: "Analysis Completed",
          description: `Analyzed ${data.games_with_predictions} games with predictions`,
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Error",
        description: error.message || "Failed to run analysis",
        variant: "destructive"
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatScore = (value: number) => value.toFixed(2);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Historical Analysis & Backfill</h1>
      </div>

      <Tabs defaultValue="backfill" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="backfill">Data Backfill</TabsTrigger>
          <TabsTrigger value="analysis">Prediction Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="backfill" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Historical Data Backfill
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Use this tool to populate historical data for back-testing. This will fetch schedules, lineups, and generate predictions for past dates.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={backfillForm.startDate}
                    onChange={(e) => setBackfillForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={backfillForm.endDate}
                    onChange={(e) => setBackfillForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeLineups"
                    checked={backfillForm.includeLineups}
                    onCheckedChange={(checked) => 
                      setBackfillForm(prev => ({ ...prev, includeLineups: checked === true }))
                    }
                  />
                  <Label htmlFor="includeLineups">Include Lineups</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includePredictions"
                    checked={backfillForm.includePredictions}
                    onCheckedChange={(checked) => 
                      setBackfillForm(prev => ({ ...prev, includePredictions: checked === true }))
                    }
                  />
                  <Label htmlFor="includePredictions">Generate Predictions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="force"
                    checked={backfillForm.force}
                    onCheckedChange={(checked) => 
                      setBackfillForm(prev => ({ ...prev, force: checked === true }))
                    }
                  />
                  <Label htmlFor="force">Force re-ingestion (overwrite existing data)</Label>
                </div>
              </div>

              <Button 
                onClick={handleBackfill}
                disabled={backfillLoading}
                className="w-full"
              >
                {backfillLoading ? 'Processing...' : 'Start Backfill'}
              </Button>

              {backfillResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Backfill Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{backfillResult.processedDays}</div>
                        <div className="text-sm text-muted-foreground">Days Processed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{backfillResult.scheduleSuccess}</div>
                        <div className="text-sm text-muted-foreground">Schedule Success</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{backfillResult.lineupSuccess}</div>
                        <div className="text-sm text-muted-foreground">Lineup Success</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{backfillResult.predictionSuccess}</div>
                        <div className="text-sm text-muted-foreground">Prediction Success</div>
                      </div>
                    </div>

                    <Progress 
                      value={(backfillResult.processedDays / backfillResult.totalDays) * 100} 
                      className="mb-4" 
                    />

                    {backfillResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-destructive">Errors:</h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {backfillResult.errors.map((error, index) => (
                            <div key={index} className="text-sm bg-destructive/10 p-2 rounded text-destructive">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Prediction Performance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  Analyze how well our predictions performed against actual game results. Only completed games with final scores are included.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="analysisStartDate">Start Date</Label>
                  <Input
                    id="analysisStartDate"
                    type="date"
                    value={analysisForm.startDate}
                    onChange={(e) => setAnalysisForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="analysisEndDate">End Date</Label>
                  <Input
                    id="analysisEndDate"
                    type="date"
                    value={analysisForm.endDate}
                    onChange={(e) => setAnalysisForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeDetails"
                  checked={analysisForm.includeDetails}
                  onCheckedChange={(checked) => 
                    setAnalysisForm(prev => ({ ...prev, includeDetails: checked === true }))
                  }
                />
                <Label htmlFor="includeDetails">Include detailed game-by-game results</Label>
              </div>

              <Button 
                onClick={handleAnalysis}
                disabled={analysisLoading}
                className="w-full"
              >
                {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
              </Button>

              {analysisResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{analysisResult.games_with_predictions}</div>
                        <div className="text-sm text-muted-foreground">Games Analyzed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatPercentage(analysisResult.accuracy_percentage)}
                        </div>
                        <div className="text-sm text-muted-foreground">Accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatScore(analysisResult.avg_confidence_score)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {formatScore(analysisResult.avg_score_error)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Score Error</div>
                      </div>
                    </div>

                    {analysisResult.details && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Game-by-Game Details</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Matchup</TableHead>
                                <TableHead>Predicted</TableHead>
                                <TableHead>Actual</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Confidence</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analysisResult.details.map((detail: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>{detail.game_date}</TableCell>
                                  <TableCell>
                                    {detail.away_team} @ {detail.home_team}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div>
                                        {formatPercentage(detail.predicted_home_win_prob)} H / {formatPercentage(detail.predicted_away_win_prob)} A
                                      </div>
                                      {detail.predicted_home_score !== null && (
                                        <div className="text-sm text-muted-foreground">
                                          {detail.predicted_home_score} - {detail.predicted_away_score}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>{detail.actual_home_score} - {detail.actual_away_score}</div>
                                    <div className="text-sm text-muted-foreground capitalize">
                                      {detail.actual_winner} wins
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={detail.prediction_correct ? 'default' : 'destructive'}>
                                      {detail.prediction_correct ? 'Correct' : 'Wrong'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {detail.confidence_score ? formatScore(detail.confidence_score) : 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricalAnalysis;