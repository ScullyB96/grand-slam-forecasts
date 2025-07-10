
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Calendar, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useLineupIngestion } from '@/hooks/useLineupIngestion';
import { useLineupJobs, useLatestLineupJob } from '@/hooks/useLineupJobs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const LineupIngestionCard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [forceRefresh, setForceRefresh] = useState(false);
  
  const lineupIngestion = useLineupIngestion();
  const { data: jobs, refetch: refetchJobs } = useLineupJobs();
  const { data: latestJob } = useLatestLineupJob(selectedDate);
  const { toast } = useToast();

  const handleIngestLineups = async () => {
    try {
      const result = await lineupIngestion.mutateAsync({
        date: selectedDate,
        force: forceRefresh
      });

      toast({
        title: 'Lineup Ingestion Started',
        description: `Processing ${result.games_expected} games for ${selectedDate}`,
      });

      // Refetch jobs to show updated status
      setTimeout(() => refetchJobs(), 1000);
    } catch (error) {
      toast({
        title: 'Ingestion Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'completed_with_errors':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Completed with Errors</Badge>;
      case 'running':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lineup Ingestion
        </CardTitle>
        <CardDescription>
          Fetch and store daily MLB lineups from the official API
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Options</label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="force-refresh"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="force-refresh" className="text-sm">
                Force refresh existing lineups
              </label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleIngestLineups}
          disabled={lineupIngestion.isPending}
          className="w-full"
        >
          {lineupIngestion.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Ingesting Lineups...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              Ingest Lineups
            </>
          )}
        </Button>

        {latestJob && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Latest Job Status</h4>
              {getStatusBadge(latestJob.status)}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Expected</div>
                <div className="font-medium">{latestJob.games_expected}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Processed</div>
                <div className="font-medium">{latestJob.games_processed}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Failed</div>
                <div className="font-medium">{latestJob.games_failed}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Started</div>
                <div className="font-medium">
                  {format(new Date(latestJob.started_at), 'HH:mm:ss')}
                </div>
              </div>
            </div>

            {latestJob.error_details && (
              <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
                {latestJob.error_details}
              </div>
            )}
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Recent Jobs</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{job.job_date}</span>
                    <span className="text-muted-foreground">
                      ({job.games_processed}/{job.games_expected})
                    </span>
                  </div>
                  {getStatusBadge(job.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LineupIngestionCard;
