import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGeneratePredictions } from '@/hooks/useMonteCarloSimulation';

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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefreshPredictions}
      disabled={disabled || isPending || !gameIds?.length}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Generating Monte Carlo Predictions...' : 'Generate Monte Carlo Predictions'}
    </Button>
  );
};

export default RefreshPredictionsButton;