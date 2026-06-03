import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface MatchupTeam<T> {
  id: string;
  name: string;
  payload: T;
}

export type Matchup<T> = [MatchupTeam<T>, MatchupTeam<T>];

interface MatchupSelectionProps<T> {
  teams: MatchupTeam<T>[];
  title: string;
  description: string;
  confirmLabel: string;
  matchupLabel?: string;
  maxMatchups?: number;
  loading?: boolean;
  onBack: () => void;
  onConfirm: (matchups: Matchup<T>[]) => void;
}

export function MatchupSelection<T>({
  teams,
  title,
  description,
  confirmLabel,
  matchupLabel = 'Court',
  maxMatchups,
  loading,
  onBack,
  onConfirm,
}: MatchupSelectionProps<T>) {
  const matchupCount = Math.min(maxMatchups ?? teams.length, Math.floor(teams.length / 2));
  const [matchups, setMatchups] = useState<Array<{ teamA?: string; teamB?: string }>>(
    Array.from({ length: matchupCount }, () => ({}))
  );
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const selectedIds = new Set(matchups.flatMap((matchup) => [matchup.teamA, matchup.teamB]).filter(Boolean) as string[]);
  const canConfirm = matchupCount > 0 && matchups.every((matchup) => matchup.teamA && matchup.teamB);

  const updateMatchup = (index: number, slot: 'teamA' | 'teamB', teamId: string) => {
    setMatchups((prev) =>
      prev.map((matchup, matchupIndex) => {
        if (matchupIndex === index) {
          const next = { ...matchup, [slot]: teamId };
          if (next.teamA === next.teamB) {
            next[slot === 'teamA' ? 'teamB' : 'teamA'] = undefined;
          }
          return next;
        }

        return {
          teamA: matchup.teamA === teamId ? undefined : matchup.teamA,
          teamB: matchup.teamB === teamId ? undefined : matchup.teamB,
        };
      })
    );
  };

  const confirm = () => {
    const selectedMatchups = matchups
      .map((matchup) => {
        const teamA = matchup.teamA ? teamById.get(matchup.teamA) : undefined;
        const teamB = matchup.teamB ? teamById.get(matchup.teamB) : undefined;
        return teamA && teamB ? [teamA, teamB] : undefined;
      })
      .filter(Boolean) as Matchup<T>[];

    onConfirm(selectedMatchups);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {matchups.map((matchup, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <Select value={matchup.teamA ?? ''} onValueChange={(value) => updateMatchup(index, 'teamA', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Team A" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((team) => team.id === matchup.teamA || !selectedIds.has(team.id))
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <div className="text-center text-sm font-medium text-muted-foreground">{matchupLabel} {index + 1}</div>

              <Select value={matchup.teamB ?? ''} onValueChange={(value) => updateMatchup(index, 'teamB', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Team B" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((team) => team.id === matchup.teamB || !selectedIds.has(team.id))
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button className="flex-1" onClick={confirm} disabled={loading || !canConfirm}>
          {loading ? 'Starting...' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
