
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import StatsTable from "@/components/StatsTable";
import TeamStatsCard from "@/components/TeamStatsCard";
import { useTeamStats } from "@/hooks/useTeamStats";
import { useBattingStats } from "@/hooks/useBattingStats";
import { usePitchingStats } from "@/hooks/usePitchingStats";
import { Badge } from "@/components/ui/badge";

const Stats = () => {
  const [selectedSeason, setSelectedSeason] = useState<number>(2024);
  const [selectedTeam, setSelectedTeam] = useState<number | undefined>();

  const { data: teamStats, isLoading: teamStatsLoading } = useTeamStats(selectedSeason);
  const { data: battingStats, isLoading: battingStatsLoading } = useBattingStats(selectedSeason, selectedTeam);
  const { data: pitchingStats, isLoading: pitchingStatsLoading } = usePitchingStats(selectedSeason, selectedTeam);

  const battingColumns = [
    {
      key: 'player',
      label: 'Player',
      render: (player: any) => (
        <div>
          <div className="font-semibold">{player?.full_name}</div>
          <div className="text-sm text-muted-foreground">{player?.position}</div>
        </div>
      )
    },
    {
      key: 'team',
      label: 'Team',
      render: (team: any) => team ? <Badge variant="outline">{team.abbreviation}</Badge> : '-'
    },
    { key: 'avg', label: 'AVG', render: (avg: number) => avg?.toFixed(3) },
    { key: 'home_runs', label: 'HR' },
    { key: 'rbi', label: 'RBI' },
    { key: 'ops', label: 'OPS', render: (ops: number) => ops?.toFixed(3) },
    { key: 'wrc_plus', label: 'wRC+' }
  ];

  const pitchingColumns = [
    {
      key: 'player',
      label: 'Player',
      render: (player: any) => (
        <div>
          <div className="font-semibold">{player?.full_name}</div>
          <div className="text-sm text-muted-foreground">{player?.position}</div>
        </div>
      )
    },
    {
      key: 'team',
      label: 'Team',
      render: (team: any) => team ? <Badge variant="outline">{team.abbreviation}</Badge> : '-'
    },
    { key: 'era', label: 'ERA', render: (era: number) => era?.toFixed(2) },
    { key: 'wins', label: 'W' },
    { key: 'saves', label: 'SV' },
    { key: 'strikeouts', label: 'K' },
    { key: 'whip', label: 'WHIP', render: (whip: number) => whip?.toFixed(2) }
  ];

  const seasons = [2024, 2023, 2022, 2021, 2020];
  const teams = teamStats?.map(stat => stat.team) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-foreground mb-2">
            MLB Statistics
          </h2>
          <p className="text-xl text-muted-foreground">
            Comprehensive baseball statistics and analytics
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <Select value={selectedSeason.toString()} onValueChange={(value) => setSelectedSeason(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(season => (
                <SelectItem key={season} value={season.toString()}>{season}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedTeam?.toString() || "all"} onValueChange={(value) => setSelectedTeam(value === "all" ? undefined : Number(value))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teams">Team Stats</TabsTrigger>
            <TabsTrigger value="batting">Batting</TabsTrigger>
            <TabsTrigger value="pitching">Pitching</TabsTrigger>
          </TabsList>
          
          <TabsContent value="teams" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamStatsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
                ))
              ) : teamStats?.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground">No team statistics available for {selectedSeason}</p>
                </div>
              ) : (
                teamStats?.map((stats) => (
                  <TeamStatsCard
                    key={stats.id}
                    team={stats.team}
                    stats={stats}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="batting" className="space-y-4">
            <StatsTable
              title="Batting Statistics"
              data={battingStats}
              columns={battingColumns}
              isLoading={battingStatsLoading}
            />
          </TabsContent>
          
          <TabsContent value="pitching" className="space-y-4">
            <StatsTable
              title="Pitching Statistics"
              data={pitchingStats}
              columns={pitchingColumns}
              isLoading={pitchingStatsLoading}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Stats;
