
import React, { useState } from 'react';
import { useGames } from '@/hooks/useGames';
import { useScheduleDebug, useVerifyIngestion } from '@/hooks/useScheduleDebug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Download, Bug, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RefreshPredictionsButton from '@/components/RefreshPredictionsButton';

interface Game {
  id: number;
  game_id: number;
  game_date: string;
  game_time?: string;
  home_team: {
    name: string;
    abbreviation: string;
  };
  away_team: {
    name: string;
    abbreviation: string;
  };
  status: string;
}

interface GameSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onGameSelect: (gameId: number) => void;
  selectedGameId?: number;
}

const GameSelector: React.FC<GameSelectorProps> = ({
  selectedDate,
  onDateChange,
  onGameSelect,
  selectedGameId
}) => {
  const { data: games, isLoading, error, refetch } = useGames(selectedDate);
  const { data: debugData, refetch: refetchDebug } = useScheduleDebug();
  const { data: verificationData } = useVerifyIngestion(selectedDate);
  const [isFetching, setIsFetching] = useState(false);
  const [generatingPredictions, setGeneratingPredictions] = useState(false);
  const { toast } = useToast();

  // Check if last run was successful and games were processed
  const isLastRunSuccessful = debugData?.lastJob?.status === 'completed' && 
                              (debugData?.lastJob?.records_inserted || 0) > 0;

  const handleFetchSchedule = async () => {
    setIsFetching(true);
    try {
      console.log('Triggering schedule fetch...');
      
      const { data, error } = await supabase.functions.invoke('fetch-schedule', {
        body: { date: selectedDate }
      });
      
      if (error) {
        console.error('Supabase function invoke error:', error);
        
        // Get debug information on error
        try {
          const { data: debugResponse } = await supabase.functions.invoke('fetch-schedule/debug-schedule');
          console.log('Debug response after error:', debugResponse);
        } catch (debugError) {
          console.error('Failed to fetch debug info:', debugError);
        }
        
        throw new Error(`Function invocation failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No response received from fetch-schedule function');
      }

      console.log('Schedule fetch response:', data);

      if (data.success) {
        toast({
          title: "Schedule Updated Successfully",
          description: `Fetched ${data.gamesProcessed} games for ${selectedDate}. Verification: ${data.verification?.success ? 'Passed' : 'Failed'}`,
          variant: data.verification?.success ? "default" : "destructive"
        });

        // Refresh both games and debug data
        setTimeout(() => {
          refetch();
          refetchDebug();
        }, 1000);
      } else {
        throw new Error(data.error || 'Schedule fetch failed');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      
      // Try to get debug information
      try {
        const { data: debugResponse } = await supabase.functions.invoke('fetch-schedule/debug-schedule');
        console.log('Debug response after error:', debugResponse);
      } catch (debugError) {
        console.error('Failed to fetch debug info:', debugError);
      }
      
      toast({
        title: "Schedule Fetch Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleGeneratePredictions = async () => {
    if (!games || games.length === 0) {
      toast({
        title: "No Games Available",
        description: "Please fetch the schedule first before generating predictions",
        variant: "destructive"
      });
      return;
    }

    setGeneratingPredictions(true);
    try {
      const gameIds = games.map(game => game.game_id);
      
      const { error } = await supabase.functions.invoke('generate-predictions', {
        body: { game_ids: gameIds }
      });

      if (error) throw error;

      toast({
        title: "Predictions Generated",
        description: `Generated predictions for ${games.length} games`
      });

      // Refresh the predictions data using React Query
      setTimeout(() => {
        refetch();
      }, 1000);

    } catch (error) {
      console.error('Error generating predictions:', error);
      toast({
        title: "Prediction Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setGeneratingPredictions(false);
    }
  };

  const handleShowDebugLogs = () => {
    if (debugData?.lastJob) {
      console.log('=== SCHEDULE DEBUG INFO ===');
      console.log('Last Job Details:', debugData.lastJob);
      console.log('Summary:', debugData.summary);
      console.log('=== END DEBUG INFO ===');
      
      toast({
        title: "Debug Information",
        description: `Last job: ${debugData.lastJob.status}. Check console for details.`
      });
    } else {
      toast({
        title: "No Debug Data",
        description: "No recent ingestion jobs found."
      });
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    // Parse date as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatGameTime = (game: Game) => {
    if (!game.game_time) return 'TBD';
    
    // Game time is already in EST from the edge function, just format it nicely
    const [hours, minutes] = game.game_time.split(':');
    const hour24 = parseInt(hours);
    const minute = parseInt(minutes);
    
    // Convert to 12-hour format
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    
    return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Calendar className="h-5 w-5" />
            Error Loading Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Failed to load games: {error.message}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button 
              variant="outline" 
              onClick={handleFetchSchedule} 
              disabled={isFetching}
            >
              <Download className="h-4 w-4 mr-2" />
              {isFetching ? 'Fetching...' : 'Fetch Schedule'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShowDebugLogs}>
              <Bug className="h-4 w-4 mr-2" />
              Debug Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Loading Games...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Games for {formatDisplayDate(selectedDate)}
        </CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFetchSchedule}
            disabled={isFetching}
          >
            <Download className="h-4 w-4 mr-2" />
            {isFetching ? 'Fetching...' : 'Fetch Schedule'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShowDebugLogs}>
            <Bug className="h-4 w-4 mr-2" />
            Debug
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleGeneratePredictions}
            disabled={generatingPredictions || !games?.length || !isLastRunSuccessful}
          >
            {generatingPredictions ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Predictions'
            )}
          </Button>
          {games && games.length > 0 && (
            <RefreshPredictionsButton
              gameIds={games.map(g => g.game_id)}
              onRefresh={() => refetch()}
              disabled={!isLastRunSuccessful}
            />
          )}
        </div>
      </CardHeader>
      
      {/* Status indicators */}
      <CardContent className="pt-0">
        <div className="flex gap-2 mb-4 text-xs">
          {debugData && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${
              isLastRunSuccessful ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isLastRunSuccessful ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Last Run: {isLastRunSuccessful ? 'Success' : debugData.lastJob?.status || 'Failed'}
            </div>
          )}
          {verificationData && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${
              verificationData.success ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {verificationData.success ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              DB: {verificationData.gameCount} games
            </div>
          )}
        </div>

        <div className="mb-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 border rounded-md w-full max-w-xs"
          />
        </div>
        
        {!games || games.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-muted-foreground">
              No games scheduled for this date
            </div>
            <div className="text-sm text-muted-foreground">
              Try fetching the latest schedule from MLB or select a different date
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                onClick={handleFetchSchedule}
                disabled={isFetching}
              >
                <Download className="h-4 w-4 mr-2" />
                {isFetching ? 'Fetching Schedule...' : 'Fetch MLB Schedule'}
              </Button>
              <Button 
                variant="secondary"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  onDateChange(tomorrow.toISOString().split('T')[0]);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Try Tomorrow
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {games.map((game) => (
              <div
                key={game.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedGameId === game.game_id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => onGameSelect(game.game_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium">
                      {game.away_team.abbreviation} @ {game.home_team.abbreviation}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatGameTime(game)} EST
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {game.status}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {game.away_team.name} at {game.home_team.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GameSelector;
