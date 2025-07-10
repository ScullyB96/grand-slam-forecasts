import React, { useState } from 'react';
import Header from '@/components/Header';
import { useScheduleDebug, useVerifyIngestion } from '@/hooks/useScheduleDebug';
import { useGames } from '@/hooks/useGames';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, Download, Bug, CheckCircle, XCircle, AlertTriangle, Database, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PlayerStatsBackfillCard } from '@/components/PlayerStatsBackfillCard';
import LineupMonitorCard from '@/components/LineupMonitorCard';

const Admin = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFetching, setIsFetching] = useState(false);
  const { data: games, refetch } = useGames(selectedDate);
  const { data: debugData, refetch: refetchDebug } = useScheduleDebug();
  const { data: verificationData } = useVerifyIngestion(selectedDate);
  const { toast } = useToast();

  const isLastRunSuccessful = debugData?.lastJob?.status === 'completed' || 
                              (games && games.length > 0);

  const handleFetchSchedule = async () => {
    setIsFetching(true);
    try {
      console.log('Triggering schedule fetch...');
      
      const { data, error } = await supabase.functions.invoke('fetch-schedule', {
        body: { date: selectedDate }
      });
      
      if (error) {
        console.error('Supabase function invoke error:', error);
        
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

        setTimeout(() => {
          refetch();
          refetchDebug();
        }, 1000);
      } else {
        throw new Error(data.error || 'Schedule fetch failed');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      
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

  const handleIngestTeamStats = async () => {
    try {
      toast({
        title: "Ingesting Team Statistics",
        description: "Fetching current season team stats from MLB API..."
      });

      const { error } = await supabase.functions.invoke('ingest-team-stats');
      if (error) throw error;

      toast({
        title: "Team Stats Ingested Successfully",
        description: "Current season team statistics have been updated"
      });
    } catch (error) {
      console.error('Error ingesting team stats:', error);
      toast({
        title: "Team Stats Ingestion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleIngestParkFactors = async () => {
    try {
      toast({
        title: "Ingesting Park Factors",
        description: "Updating ballpark factors for all venues..."
      });

      const { error } = await supabase.functions.invoke('ingest-park-factors');
      if (error) throw error;

      toast({
        title: "Park Factors Ingested Successfully",
        description: "Ballpark factors have been updated for all venues"
      });
    } catch (error) {
      console.error('Error ingesting park factors:', error);
      toast({
        title: "Park Factors Ingestion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleIngestWeatherData = async () => {
    try {
      toast({
        title: "Ingesting Weather Data",
        description: "Fetching weather forecasts for upcoming games..."
      });

      const { error } = await supabase.functions.invoke('ingest-weather-data');
      if (error) throw error;

      toast({
        title: "Weather Data Ingested Successfully",
        description: "Weather forecasts have been updated for upcoming games"
      });
    } catch (error) {
      console.error('Error ingesting weather data:', error);
      toast({
        title: "Weather Data Ingestion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleIngestLineups = async () => {
    try {
      toast({
        title: "Ingesting Lineups",
        description: "Fetching lineups from MLB API and backup sources..."
      });

      const { data, error } = await supabase.functions.invoke('ingest-lineups');
      if (error) throw error;

      toast({
        title: "Lineups Ingested Successfully",
        description: `Processed ${data?.processed || 0} lineup entries with ${data?.official_lineups || 0} official lineups`
      });
    } catch (error) {
      console.error('Error ingesting lineups:', error);
      toast({
        title: "Lineup Ingestion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
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
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-xl text-muted-foreground">
            Data management, debugging, and system administration
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-2">
                  Target Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded-md w-full"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>

              <div className="flex gap-2 text-xs">
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

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                <Button variant="outline" size="sm" onClick={handleShowDebugLogs}>
                  <Bug className="h-4 w-4 mr-2" />
                  Debug Logs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Ingestion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Ingestion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="secondary"
                  onClick={handleFetchSchedule}
                  disabled={isFetching}
                  className="justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isFetching ? 'Fetching Schedule...' : 'Fetch MLB Schedule'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleIngestTeamStats}
                  className="justify-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Ingest Team Stats
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleIngestParkFactors}
                  className="justify-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Ingest Park Factors
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleIngestWeatherData}
                  className="justify-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Ingest Weather Data
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleIngestLineups}
                  className="justify-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Ingest Lineups
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Player Statistics */}
          <PlayerStatsBackfillCard />

          {/* Lineup Monitor */}
          <LineupMonitorCard />

          {/* ML Pipeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Advanced ML Prediction Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Button 
                  variant="outline" 
                  onClick={() => supabase.functions.invoke('data-audit-engine', { body: { enable_mock_fallback: true } })}
                  className="justify-start"
                >
                  🔍 Data Audit
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => supabase.functions.invoke('feature-engineering', { body: { target_date: selectedDate } })}
                  className="justify-start"
                >
                  🔧 Feature Engineering
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => supabase.functions.invoke('ml-prediction-engine', { body: { game_ids: games?.map(g => g.game_id) } })}
                  className="justify-start"
                >
                  🧠 ML Predictions
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => supabase.functions.invoke('model-validation', { body: { validation_type: 'all' } })}
                  className="justify-start"
                >
                  📊 Model Health
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Advanced ML pipeline with XGBoost + Monte Carlo, comprehensive validation, and real-time monitoring
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;