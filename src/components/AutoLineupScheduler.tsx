import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Play, Pause, Settings, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SchedulerSettings {
  enabled: boolean;
  interval_minutes: number;
  last_run: string | null;
  next_run: string | null;
}

const AutoLineupScheduler = () => {
  const [localSettings, setLocalSettings] = useState<SchedulerSettings>({
    enabled: false,
    interval_minutes: 15,
    last_run: null,
    next_run: null
  });
  
  const { toast } = useToast();

  const { data: settings, refetch } = useQuery({
    queryKey: ['lineup-scheduler-settings'],
    queryFn: async () => {
      // In a real implementation, this would fetch from a settings table
      // For now, we'll simulate the settings
      return localSettings;
    }
  });

  const updateScheduler = useMutation({
    mutationFn: async (newSettings: Partial<SchedulerSettings>) => {
      // In a real implementation, this would update the database and cron job
      const updated = { ...localSettings, ...newSettings };
      setLocalSettings(updated);
      
      // Simulate API call to update cron job
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return updated;
    },
    onSuccess: () => {
      toast({
        title: "Scheduler Updated",
        description: "Lineup monitoring schedule has been updated successfully.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('lineup-monitor');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Lineup Monitor Complete",
        description: `Checked ${data.checked} games, updated ${data.updated} with official lineups`,
      });
      setLocalSettings(prev => ({
        ...prev,
        last_run: new Date().toISOString()
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Monitor Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggleScheduler = (enabled: boolean) => {
    updateScheduler.mutate({ enabled });
  };

  const handleIntervalChange = (interval: string) => {
    updateScheduler.mutate({ interval_minutes: parseInt(interval) });
  };

  const getNextRunTime = () => {
    if (!localSettings.enabled || !localSettings.last_run) return null;
    
    const lastRun = new Date(localSettings.last_run);
    const nextRun = new Date(lastRun.getTime() + localSettings.interval_minutes * 60 * 1000);
    
    return nextRun;
  };

  const nextRun = getNextRunTime();
  const isOverdue = nextRun && nextRun < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Auto Lineup Scheduler
        </CardTitle>
        <CardDescription>
          Automatically monitor for official lineup releases throughout the day
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scheduler Status */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="scheduler-toggle" className="text-sm font-medium">
                Auto Monitoring
              </Label>
              <Badge variant={localSettings.enabled ? "default" : "secondary"}>
                {localSettings.enabled ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {localSettings.enabled 
                ? `Checks every ${localSettings.interval_minutes} minutes for official lineups`
                : "Manual monitoring only"
              }
            </p>
          </div>
          <Switch
            id="scheduler-toggle"
            checked={localSettings.enabled}
            onCheckedChange={handleToggleScheduler}
            disabled={updateScheduler.isPending}
          />
        </div>

        {/* Schedule Settings */}
        {localSettings.enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="interval-select">Check Interval</Label>
              <Select
                value={localSettings.interval_minutes.toString()}
                onValueChange={handleIntervalChange}
                disabled={updateScheduler.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="10">Every 10 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Last Run</Label>
                <div className="font-medium">
                  {localSettings.last_run 
                    ? new Date(localSettings.last_run).toLocaleString()
                    : 'Never'
                  }
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Next Run</Label>
                <div className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>
                  {nextRun 
                    ? nextRun.toLocaleString()
                    : 'Calculating...'
                  }
                  {isOverdue && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Actions */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4" />
            <Label className="text-sm font-medium">Manual Actions</Label>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
              className="w-full"
              variant="outline"
            >
              {runNow.isPending ? (
                <>
                  <Zap className="mr-2 h-4 w-4 animate-pulse" />
                  Running Monitor...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Monitor Now
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Manually trigger the lineup monitor to check for official lineups immediately
            </p>
          </div>
        </div>

        {/* Performance Notes */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>Performance Notes:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>More frequent checks increase API usage but provide faster updates</li>
            <li>Official lineups typically release 1-2 hours before game time</li>
            <li>The system automatically detects and replaces mock lineups</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoLineupScheduler;