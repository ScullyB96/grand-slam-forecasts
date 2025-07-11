import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlayerStatsBackfill } from '@/hooks/usePlayerStatsBackfill';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, Users, Target, Activity } from 'lucide-react';

export const PlayerStatsBackfillCard = () => {
  const [season, setSeason] = useState(new Date().getFullYear());
  const [includeRosters, setIncludeRosters] = useState(true);
  const [includeBattingStats, setIncludeBattingStats] = useState(true);
  const [includePitchingStats, setIncludePitchingStats] = useState(true);
  const [force, setForce] = useState(false);

  const { mutate: runBackfill, isPending } = usePlayerStatsBackfill();
  const { toast } = useToast();

  const handleRunBackfill = () => {
    runBackfill({
      season,
      includeRosters,
      includeBattingStats,
      includePitchingStats,
      force
    }, {
      onSuccess: (data) => {
        toast({
          title: "Player Stats Backfill Completed",
          description: `${data.message}. Completed ${data.stepsCompleted}/${data.totalSteps} steps.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Player Stats Backfill Failed",
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
          <Database className="h-5 w-5" />
          Player Statistics Backfill
        </CardTitle>
        <CardDescription>
          Ingest comprehensive player data including rosters, batting stats, and pitching stats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="season">Season</Label>
            <Input
              id="season"
              type="number"
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value))}
              min={2020}
              max={new Date().getFullYear()}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Data Types to Include</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rosters"
              checked={includeRosters}
              onCheckedChange={(checked) => setIncludeRosters(checked === true)}
            />
            <Label htmlFor="rosters" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Player Rosters
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="batting"
              checked={includeBattingStats}
              onCheckedChange={(checked) => setIncludeBattingStats(checked === true)}
            />
            <Label htmlFor="batting" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Batting Statistics
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="pitching"
              checked={includePitchingStats}
              onCheckedChange={(checked) => setIncludePitchingStats(checked === true)}
            />
            <Label htmlFor="pitching" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Pitching Statistics
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="force"
              checked={force}
              onCheckedChange={(checked) => setForce(checked === true)}
            />
            <Label htmlFor="force">
              Force re-ingestion (overwrite existing data)
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button 
            onClick={handleRunBackfill} 
            disabled={isPending || (!includeRosters && !includeBattingStats && !includePitchingStats)}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Player Stats Backfill...
              </>
            ) : (
              'Run Player Stats Backfill'
            )}
          </Button>

          <Button 
            onClick={() => {
              console.log('🎯 Starting Real Data Plan implementation...');
              
              // Step 1: Ingest 2025 rosters first
              toast({
                title: "Real Data Plan Started",
                description: "Step 1: Ingesting 2025 player rosters...",
              });
              
              runBackfill({
                season: 2025,
                includeRosters: true,
                includeBattingStats: false,
                includePitchingStats: false,
                force: false
              }, {
                onSuccess: (rosterData) => {
                  console.log('✅ 2025 rosters completed:', rosterData);
                  
                  toast({
                    title: "2025 Rosters Complete",
                    description: `Step 2: Now ingesting 2024 player statistics...`,
                  });
                  
                  // Step 2: After successful roster ingestion, get 2024 stats
                  runBackfill({
                    season: 2024,
                    includeRosters: false,
                    includeBattingStats: true,
                    includePitchingStats: true,
                    force: false
                  }, {
                    onSuccess: (statsData) => {
                      console.log('✅ 2024 stats completed:', statsData);
                      
                      toast({
                        title: "Real Data Plan Complete",
                        description: `Successfully ingested 2025 rosters (${rosterData.rosterResults?.playersInserted || 0} players) and 2024 statistics (${statsData.battingResults?.statsInserted || 0} batting, ${statsData.pitchingResults?.statsInserted || 0} pitching). Monte Carlo simulation now uses real MLB data!`,
                      });
                    },
                    onError: (error) => {
                      console.error('❌ 2024 stats failed:', error);
                      toast({
                        title: "2024 Stats Backfill Failed",
                        description: `Failed during Step 2 (statistics ingestion): ${error.message}`,
                        variant: "destructive",
                      });
                    }
                  });
                },
                onError: (error) => {
                  console.error('❌ 2025 rosters failed:', error);
                  toast({
                    title: "2025 Roster Backfill Failed",
                    description: `Failed during Step 1 (roster ingestion): ${error.message}`,
                    variant: "destructive",
                  });
                }
              });
            }}
            disabled={isPending}
            variant="secondary"
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Implementing Real Data Plan...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Implement Real Data Plan (2025 Rosters + 2024 Stats)
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>This will ingest player data for the {season} season.</p>
          <p>• Rosters: Player profiles and team assignments</p>
          <p>• Batting Stats: Offensive statistics for all position players</p>
          <p>• Pitching Stats: Pitching statistics for all pitchers</p>
          
          <div className="mt-3 p-3 bg-muted/50 rounded-md">
            <p className="font-medium text-foreground mb-1">Real Data Plan:</p>
            <p>Fixes the model's data-season mismatch by ingesting 2025 rosters combined with 2024 historical stats. This provides the Monte Carlo simulation with current team compositions and proven performance data for accurate predictions.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};