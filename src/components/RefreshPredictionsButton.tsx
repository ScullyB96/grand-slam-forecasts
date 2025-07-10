import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshPredictions = async () => {
    if (!gameIds || gameIds.length === 0) {
      toast({
        title: "No Games Available",
        description: "No games available to generate predictions for",
        variant: "destructive"
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('generate-predictions', {
        body: { game_ids: gameIds }
      });

      if (error) throw error;

      toast({
        title: "Predictions Refreshed",
        description: `Updated predictions for ${gameIds.length} games`
      });

      // Call the refresh callback
      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }

    } catch (error) {
      console.error('Error refreshing predictions:', error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefreshPredictions}
      disabled={disabled || isRefreshing || !gameIds?.length}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh Predictions'}
    </Button>
  );
};

export default RefreshPredictionsButton;