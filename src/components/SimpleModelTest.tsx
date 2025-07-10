import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Target, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ModelTestResult {
  success: boolean;
  testDate: string;
  steps: {
    schedule: { success: boolean; gamesFound: number; errors: number };
    lineups: { success: boolean; playersFound: number; errors: number };
    predictions: { success: boolean; predictionsGenerated: number; errors: number };
    analysis: {
      totalGames: number;
      gamesWithPredictions: number;
      accuracy: string;
      avgConfidence: string;
      avgScoreError: string;
      details?: any[];
    } | { error: string };
  };
  message: string;
}

const SimpleModelTest: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ModelTestResult | null>(null);

  const runModelTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('simple-model-test');

      if (error) {
        throw error;
      }

      setResult(data);
      
      if (data.success) {
        toast({
          title: "Model Test Completed",
          description: `Tested ${data.steps.analysis.gamesWithPredictions || 0} games for ${data.testDate}`,
        });
      } else {
        toast({
          title: "Model Test Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Model test error:', error);
      toast({
        title: "Test Error",
        description: error.message || "Failed to run model test",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (success: boolean) => {
    return success ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStepStatus = (success: boolean) => {
    return success ? 'default' : 'destructive';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Simple Model Test</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Test Yesterday's Confirmed Lineups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will test our model using yesterday's confirmed lineups and pitching matchups against actual game results.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={runModelTest}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Testing Model...' : 'Run Yesterday\'s Model Test'}
          </Button>

          {result && (
            <div className="space-y-6">
              {/* Overall Status */}
              <Card className={`border-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    {getStepIcon(result.success)}
                    <h3 className="text-lg font-semibold">
                      Test Date: {result.testDate}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                </CardContent>
              </Card>

              {/* Step-by-Step Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Process Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStepIcon(result.steps.schedule.success)}
                        <span>Schedule Ingestion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStepStatus(result.steps.schedule.success)}>
                          {result.steps.schedule.gamesFound} games
                        </Badge>
                        {result.steps.schedule.errors > 0 && (
                          <Badge variant="destructive">{result.steps.schedule.errors} errors</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStepIcon(result.steps.lineups.success)}
                        <span>Lineup Ingestion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStepStatus(result.steps.lineups.success)}>
                          {result.steps.lineups.playersFound} players
                        </Badge>
                        {result.steps.lineups.errors > 0 && (
                          <Badge variant="destructive">{result.steps.lineups.errors} errors</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStepIcon(result.steps.predictions.success)}
                        <span>Prediction Generation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStepStatus(result.steps.predictions.success)}>
                          {result.steps.predictions.predictionsGenerated} predictions
                        </Badge>
                        {result.steps.predictions.errors > 0 && (
                          <Badge variant="destructive">{result.steps.predictions.errors} errors</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Results */}
              {result.steps.analysis && !('error' in result.steps.analysis) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Model Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{result.steps.analysis.gamesWithPredictions}</div>
                        <div className="text-sm text-muted-foreground">Games Analyzed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{result.steps.analysis.accuracy}</div>
                        <div className="text-sm text-muted-foreground">Accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{result.steps.analysis.avgConfidence}</div>
                        <div className="text-sm text-muted-foreground">Avg Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{result.steps.analysis.avgScoreError}</div>
                        <div className="text-sm text-muted-foreground">Avg Score Error</div>
                      </div>
                    </div>

                    {result.steps.analysis.details && result.steps.analysis.details.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Sample Game Results</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Matchup</TableHead>
                                <TableHead>Predicted</TableHead>
                                <TableHead>Actual</TableHead>
                                <TableHead>Result</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.steps.analysis.details.map((detail: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {detail.away_team} @ {detail.home_team}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="text-sm">
                                        H: {(detail.predicted_home_win_prob * 100).toFixed(1)}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        A: {(detail.predicted_away_win_prob * 100).toFixed(1)}%
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono">
                                      {detail.actual_home_score} - {detail.actual_away_score}
                                    </div>
                                    <div className="text-sm text-muted-foreground capitalize">
                                      {detail.actual_winner} wins
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={detail.prediction_correct ? 'default' : 'destructive'}>
                                      {detail.prediction_correct ? '✓' : '✗'}
                                    </Badge>
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

              {/* Error Display */}
              {result.steps.analysis && 'error' in result.steps.analysis && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>Analysis Failed: {result.steps.analysis.error}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleModelTest;