import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useLineupMonitor } from '@/hooks/useLineupMonitor';
import { useToast } from '@/hooks/use-toast';

const LineupMonitorCard = () => {
  const { mutate: runMonitor, isPending, data } = useLineupMonitor();
  const { toast } = useToast();

  const handleRunMonitor = () => {
    runMonitor(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Lineup Monitoring Complete",
          description: `Checked ${data.checked} games, updated ${data.updated} with official lineups`,
        });
      },
      onError: (error) => {
        toast({
          title: "Lineup Monitoring Failed",
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
          <Monitor className="h-5 w-5" />
          Lineup Monitor
        </CardTitle>
        <CardDescription>
          Monitor for official lineup releases and replace mock lineups with real data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Games Checked:</span>
              <Badge variant="outline">{data.checked}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Games Updated:</span>
              <Badge variant={data.updated > 0 ? "default" : "secondary"}>
                {data.updated}
              </Badge>
            </div>
            
            {data.updates && data.updates.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Recent Updates:</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.updates.slice(0, 5).map((update, index) => (
                    <div key={index} className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      {update.startsWith('Failed') ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          {update}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {update}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleRunMonitor} 
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Monitoring Lineups...
            </>
          ) : (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Check for Official Lineups
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            This tool checks MLB's API for official lineup releases and automatically 
            replaces any mock or placeholder lineups with real data.
          </p>
          <p className="text-xs">
            • Run this closer to game time when lineups are typically released (1-2 hours before)
          </p>
          <p className="text-xs">
            • Mock lineups are identified by placeholder player names and fake IDs
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LineupMonitorCard;