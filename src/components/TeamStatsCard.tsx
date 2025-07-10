
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TeamStats {
  team_id: number;
  season: number;
  wins: number;
  losses: number;
  runs_scored: number;
  runs_allowed: number;
  team_era: number;
  team_avg: number;
  team_obp: number;
  team_slg: number;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  league: string;
  division: string;
}

interface TeamStatsCardProps {
  team: Team;
  stats: TeamStats;
}

const TeamStatsCard = ({ team, stats }: TeamStatsCardProps) => {
  const winPercentage = stats.wins / (stats.wins + stats.losses);
  const runDifferential = stats.runs_scored - stats.runs_allowed;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{team.name}</CardTitle>
          <Badge variant="outline">{team.league} {team.division}</Badge>
        </div>
        <div className="text-2xl font-bold">
          {stats.wins}-{stats.losses}
          <span className="text-lg font-normal text-muted-foreground ml-2">
            ({(winPercentage * 100).toFixed(1)}%)
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Run Differential</div>
              <div className={`text-lg font-semibold flex items-center ${
                runDifferential > 0 ? 'text-green-600' : runDifferential < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {runDifferential > 0 && <TrendingUp className="h-4 w-4 mr-1" />}
                {runDifferential < 0 && <TrendingDown className="h-4 w-4 mr-1" />}
                {runDifferential > 0 ? '+' : ''}{runDifferential}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Team ERA</div>
              <div className="text-lg font-semibold">{stats.team_era.toFixed(2)}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Team AVG</div>
              <div className="text-lg font-semibold">{stats.team_avg.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">OPS</div>
              <div className="text-lg font-semibold">
                {(stats.team_obp + stats.team_slg).toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamStatsCard;
