import { useState, useEffect, useCallback } from 'react';
import { Minus, Plus, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CourtTimer } from './CourtTimer';
import { api } from '@/lib/api';
import { getTeamName } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { EventDetail, MatchDetail, RoundRobinConfig } from '@/types';

interface RoundRobinDashboardProps {
  eventId: string;
}

export function RoundRobinDashboard({ eventId }: RoundRobinDashboardProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [scores, setScores] = useState<Record<string, { t1: number; t2: number }>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const config: RoundRobinConfig = event?.config ? JSON.parse(event.config) : {};

  const fetchEvent = useCallback(async () => {
    try {
      const data = await api.events.get(eventId);
      setEvent(data);
      const initial: Record<string, { t1: number; t2: number }> = {};
      data.matches.forEach((m) => {
        if (m.status !== 'completed') {
          initial[m.id] = { t1: m.team1Score, t2: m.team2Score };
        }
      });
      setScores(initial);
    } catch {
      toast({ title: 'Error', description: 'Failed to load event', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
    const interval = setInterval(fetchEvent, 10000);
    return () => clearInterval(interval);
  }, [fetchEvent]);

  const updateScore = (matchId: string, team: 't1' | 't2', delta: number) => {
    setScores((prev) => {
      const current = prev[matchId] || { t1: 0, t2: 0 };
      const key = team;
      return {
        ...prev,
        [matchId]: { ...current, [key]: Math.max(0, current[key] + delta) },
      };
    });
  };

  const submitScore = async (match: MatchDetail, confirm = false) => {
    const s = scores[match.id] || { t1: match.team1Score, t2: match.team2Score };
    try {
      await api.matches.submitScore(match.id, {
        team1Score: s.t1,
        team2Score: s.t2,
        confirm,
      });
      toast({ title: confirm ? 'Score submitted!' : 'Score updated' });
      fetchEvent();
    } catch {
      toast({ title: 'Error', description: 'Failed to submit score', variant: 'destructive' });
    }
  };

  const nextRound = async () => {
    try {
      const result = await api.roundRobin.nextRound(eventId);
      if ('status' in result && result.status === 'completed') {
        toast({ title: 'Round Robin complete!' });
      } else {
        toast({ title: `Round ${config.currentRound + 1} started` });
      }
      fetchEvent();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!event) return <div className="text-center py-12">Event not found</div>;

  const currentRound = config.currentRound || 1;
  const currentMatches = event.matches.filter((m) => m.round === currentRound);
  const allCurrentComplete = currentMatches.every((m) => m.status === 'completed');
  const sittingOut = getSittingOutPlayers(event, currentMatches);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={event.status} />
            <span className="text-sm text-muted-foreground">Round {currentRound}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => api.events.exportCsv(eventId)}>
            <Download className="h-4 w-4" /> Export
          </Button>
          {allCurrentComplete && event.status === 'in_progress' && (
            <Button onClick={nextRound}>Next Round</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {currentMatches.map((match) => (
          <CourtCard
            key={match.id}
            match={match}
            scores={scores[match.id]}
            config={config}
            onScoreChange={(team, delta) => updateScore(match.id, team, delta)}
            onSubmit={(confirm) => submitScore(match, confirm)}
          />
        ))}
      </div>

      {sittingOut.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sitting Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sittingOut.map((name, i) => (
                <span key={i} className="rounded-full bg-muted px-3 py-1 text-sm">{name}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <StandingsTable standings={event.standings} />
    </div>
  );
}

function CourtCard({
  match,
  scores,
  config,
  onScoreChange,
  onSubmit,
}: {
  match: MatchDetail;
  scores?: { t1: number; t2: number };
  config: RoundRobinConfig;
  onScoreChange: (team: 't1' | 't2', delta: number) => void;
  onSubmit: (confirm: boolean) => void;
}) {
  const t1 = scores?.t1 ?? match.team1Score;
  const t2 = scores?.t2 ?? match.team2Score;
  const isComplete = match.status === 'completed';

  return (
    <Card className={isComplete ? 'opacity-75' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{match.court?.name || 'Court'}</CardTitle>
          <StatusBadge status={match.status} />
        </div>
        {config.scoringType === 'time' && !isComplete && (
          <CourtTimer durationMinutes={config.gameDuration || 15} />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreRow
          name={match.team1 ? getTeamName(match.team1) : 'TBD'}
          score={t1}
          onMinus={() => onScoreChange('t1', -1)}
          onPlus={() => onScoreChange('t1', 1)}
          disabled={isComplete}
          winner={isComplete && t1 > t2}
        />
        <div className="text-center text-xs text-muted-foreground font-medium">VS</div>
        <ScoreRow
          name={match.team2 ? getTeamName(match.team2) : 'TBD'}
          score={t2}
          onMinus={() => onScoreChange('t2', -1)}
          onPlus={() => onScoreChange('t2', 1)}
          disabled={isComplete}
          winner={isComplete && t2 > t1}
        />
        {!isComplete && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onSubmit(false)}>Update</Button>
            <Button className="flex-1" onClick={() => onSubmit(true)}>
              <Check className="h-4 w-4" /> Submit
            </Button>
          </div>
        )}
        {isComplete && (
          <p className="text-center text-sm font-medium text-green-600">
            Final: {t1} - {t2}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreRow({
  name, score, onMinus, onPlus, disabled, winner,
}: {
  name: string; score: number; onMinus: () => void; onPlus: () => void; disabled: boolean; winner?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${winner ? 'text-green-600 font-semibold' : ''}`}>
      <span className="flex-1 text-sm truncate">{name}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={onMinus} disabled={disabled}>
          <Minus className="h-5 w-5" />
        </Button>
        <span className="text-3xl font-bold w-12 text-center tabular-nums">{score}</span>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={onPlus} disabled={disabled}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: EventDetail['standings'] }) {
  const sorted = [...standings].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.pointsFor - a.pointsFor;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">#</th>
              <th className="pb-2 pr-4">Player/Team</th>
              <th className="pb-2 pr-4 text-center">W</th>
              <th className="pb-2 pr-4 text-center">L</th>
              <th className="pb-2 pr-4 text-center">PF</th>
              <th className="pb-2 pr-4 text-center">PA</th>
              <th className="pb-2 text-center">+/-</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{i + 1}</td>
                <td className="py-2 pr-4">{getTeamName(s.team)}</td>
                <td className="py-2 pr-4 text-center">{s.wins}</td>
                <td className="py-2 pr-4 text-center">{s.losses}</td>
                <td className="py-2 pr-4 text-center">{s.pointsFor}</td>
                <td className="py-2 pr-4 text-center">{s.pointsAgainst}</td>
                <td className="py-2 text-center">{s.pointsFor - s.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function getSittingOutPlayers(event: EventDetail, currentMatches: MatchDetail[]): string[] {
  const playingIds = new Set<string>();
  currentMatches.forEach((m) => {
    if (m.team1) {
      playingIds.add(m.team1.player1Id);
      if (m.team1.player2Id) playingIds.add(m.team1.player2Id);
    }
    if (m.team2) {
      playingIds.add(m.team2.player1Id);
      if (m.team2.player2Id) playingIds.add(m.team2.player2Id);
    }
  });
  return event.eventPlayers
    .filter((ep) => !playingIds.has(ep.playerId))
    .map((ep) => ep.player.name);
}
