import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Loader2, CheckCircle, Calendar, Database } from 'lucide-react';
import { useLineupOrchestrator } from '@/hooks/useLineupOrchestrator';
import { useToast } from '@/hooks/use-toast';

const LineupOrchestratorCard = () => {
  const { mutate: runOrchestrator, isPending, data } = useLineupOrchestrator();
  const { toast } = useToast();
  const [targetDate, setTargetDate] = React.useState(new Date().toISOString().split('T')[0]);

  const handleRunOrchestrator = () => {
    runOrchestrator(targetDate, {
      onSuccess: (data) => {
        toast({
          title: "Lineup Orchestration Complete",
          description: `Successfully processed ${data.results.games_found} games for ${data.date}`,
        });
      },
      onError: (error) => {
        toast({
          title: "Orchestration Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Lineup Orchestrator
        </CardTitle>
        <CardDescription>
          Complete lineup system orchestration: schedule validation, lineup ingestion, monitoring, and predictions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date">Target Date</Label>
          <Input
            id="date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            disabled={isPending}
          />
        </div>

        {data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Status:</span>
              <Badge variant={data.success ? "default" : "destructive"}>
                {data.success ? "Success" : "Failed"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>Games Found:</span>
              <Badge variant="outline">{data.results.games_found}</Badge>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Steps Completed:</h4>
              <div className="grid grid-cols-2 gap-1">
                {data.steps_completed.map((step, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="capitalize">{step.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {data.results && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Results Summary:</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {data.results.lineup_result && (
                    <div>Lineups: {data.results.lineup_result.processed || 0} players processed</div>
                  )}
                  {data.results.monitor_result && (
                    <div>Monitor: {data.results.monitor_result.updated || 0} games updated with official lineups</div>
                  )}
                  {data.results.prediction_result && (
                    <div>Predictions: Generated for available games</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleRunOrchestrator} 
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Orchestration...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Run Complete Orchestration
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Complete system orchestration:</strong>
          </p>
          <div className="text-xs space-y-1 pl-4">
            <p>• Validates games exist in MLB schedule</p>
            <p>• Ingests/updates schedule data</p>
            <p>• Cleans up invalid games</p>
            <p>• Attempts lineup ingestion (official only)</p>
            <p>• Monitors for lineup updates</p>
            <p>• Generates predictions with available data</p>
          </div>
          <p className="text-xs font-medium text-amber-600">
            ⚠️ No mock lineups are created - only official MLB data is used
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LineupOrchestratorCard;