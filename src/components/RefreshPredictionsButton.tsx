import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search, Download, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGeneratePredictions } from '@/hooks/useMonteCarloSimulation';
import { supabase } from '@/integrations/supabase/client';

interface RefreshPredictionsButtonProps {
  gameIds: number[];
  onRefresh?: () => void;
  disabled?: boolean;
}

const RefreshPredictionsButton: React.FC<RefreshPredictionsButtonProps> = ({
  gameIds,
  onRefresh,
  disabled = false
}) => {
  const { toast } = useToast();
  const { mutate: generatePredictions, isPending } = useGeneratePredictions();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleRefreshPredictions = () => {
    if (!gameIds || gameIds.length === 0) {
      toast({
        title: "No Games Available",
        description: "No games available to generate predictions for",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Generating Predictions",
      description: "Fetching lineups and running Monte Carlo simulations..."
    });

    generatePredictions(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Monte Carlo Predictions Generated",
          description: `Generated predictions for ${data?.processed || gameIds.length} games using advanced Monte Carlo simulation`
        });

        // Call the refresh callback
        if (onRefresh) {
          setTimeout(() => {
            onRefresh();
          }, 1000);
        }
      },
      onError: (error) => {
        console.error('Error refreshing predictions:', error);
        toast({
          title: "Refresh Failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive"
        });
      }
    });
  };

  const handleMonitorLineups = async () => {
    setIsMonitoring(true);
    
    try {
      toast({
        title: "Monitoring Lineups",
        description: "Checking for confirmed official lineups..."
      });

      const { data, error } = await supabase.functions.invoke('lineup-monitor', {
        body: { source: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Lineup Monitoring Complete",
        description: `Checked ${data.checked} games, updated ${data.updated} with official lineups`,
        variant: data.updated > 0 ? "default" : "destructive"
      });

      if (data.updated > 0 && onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error) {
      console.error('Error monitoring lineups:', error);
      toast({
        title: "Monitor Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsMonitoring(false);
    }
  };

  const handleIngestLineups = async () => {
    setIsIngesting(true);
    
    try {
      toast({
        title: "Ingesting Lineups",
        description: "Fetching projected lineups from Rotowire and MLB API..."
      });

      const { data, error } = await supabase.functions.invoke('ingest-lineups', {
        body: { source: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Lineup Ingestion Complete",
        description: `${data.message} (${data.official_lineups} official, ${data.processed - data.official_lineups} projected)`,
      });

      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error) {
      console.error('Error ingesting lineups:', error);
      toast({
        title: "Ingestion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsIngesting(false);
    }
  };

  const handleTestLineups = async () => {
    setIsTesting(true);
    
    try {
      toast({
        title: "Creating Test Lineups",
        description: "Creating mock lineups for all games..."
      });

      const { data, error } = await supabase.functions.invoke('test-lineups', {
        body: { source: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Test Lineups Created",
        description: `Created ${data.processed} lineup entries for ${data.total_games} games`,
      });

      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error) {
      console.error('Error creating test lineups:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTestLineups}
        disabled={disabled || isTesting}
      >
        <TestTube className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
        {isTesting ? 'Testing...' : 'Test Lineups'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleIngestLineups}
        disabled={disabled || isIngesting}
      >
        <Download className={`h-4 w-4 mr-2 ${isIngesting ? 'animate-spin' : ''}`} />
        {isIngesting ? 'Ingesting...' : 'Ingest Lineups'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleMonitorLineups}
        disabled={disabled || isMonitoring}
      >
        <Search className={`h-4 w-4 mr-2 ${isMonitoring ? 'animate-spin' : ''}`} />
        {isMonitoring ? 'Monitoring...' : 'Check Official Lineups'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRefreshPredictions}
        disabled={disabled || isPending || !gameIds?.length}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Generating Monte Carlo Predictions...' : 'Generate Monte Carlo Predictions'}
      </Button>
    </div>
  );
};

export default RefreshPredictionsButton;