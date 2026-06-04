import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Minus, Plus, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api';
import { getTeamName } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import type { EventDetail, MatchDetail, RoundRobinConfig } from '@/types';

interface RoundRobinDashboardProps {
  eventId: string;
}

export function RoundRobinDashboard({ eventId }: RoundRobinDashboardProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [scores, setScores] = useState<Record<string, { t1: number; t2: number }>>({});
  const [loading, setLoading] = useState(true);
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null);
  const pendingScoreMatchIds = useRef(new Set<string>());
  const { toast } = useToast();

  const config: RoundRobinConfig = event?.config ? JSON.parse(event.config) : {};

  const fetchEvent = useCallback(async (force = false) => {
    if (!force && pendingScoreMatchIds.current.size > 0) return;

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

  const eventRealtimeSubscriptions = useMemo(() => [
    { table: 'Player' as const },
    { table: 'Match' as const, filter: `eventId=eq.${eventId}` },
    { table: 'Standing' as const, filter: `eventId=eq.${eventId}` },
  ], [eventId]);

  const fetchRealtimeEvent = useCallback(() => fetchEvent(true), [fetchEvent]);

  useSupabaseRealtime(`round-robin-${eventId}`, eventRealtimeSubscriptions, fetchRealtimeEvent);

  const submitScore = async (
    match: MatchDetail,
    confirm = false,
    scoreOverride?: { t1: number; t2: number }
  ) => {
    const s = scoreOverride || scores[match.id] || { t1: match.team1Score, t2: match.team2Score };
    const previousEvent = event;
    const previousScores = scores;

    if (event) {
      pendingScoreMatchIds.current.add(match.id);
      setEvent(applyOptimisticRoundRobinScore(event, match, s.t1, s.t2, confirm));
      setScores((prev) => ({
        ...prev,
        [match.id]: { t1: s.t1, t2: s.t2 },
      }));
    }

    try {
      await api.matches.submitScore(match.id, {
        team1Score: s.t1,
        team2Score: s.t2,
        confirm,
      });
      toast({ title: confirm ? 'Score submitted!' : 'Score updated' });
      pendingScoreMatchIds.current.delete(match.id);
      fetchEvent(true);
    } catch {
      pendingScoreMatchIds.current.delete(match.id);
      if (previousEvent) setEvent(previousEvent);
      setScores(previousScores);
      toast({ title: 'Error', description: 'Failed to submit score', variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!event) return <div className="text-center py-12">Event not found</div>;

  const activeMatches = event.matches
    .filter((m) => m.status === 'in_progress' && m.courtId)
    .sort(compareQueueOrder);
  const activeRoundNumbers = [...new Set(activeMatches.map((m) => m.round))].sort((a, b) => a - b);
  const currentRoundLabel =
    activeRoundNumbers.length > 0
      ? `${activeRoundNumbers.length === 1 ? 'Round' : 'Rounds'} ${activeRoundNumbers.join(', ')}`
      : `Round ${config.currentRound || 1}`;
  const sittingOut = getSittingOutPlayers(event, activeMatches);
  const scoringMatch = scoringMatchId ? event.matches.find((match) => match.id === scoringMatchId) || null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={event.status} />
            <span className="text-sm text-muted-foreground">{currentRoundLabel}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => api.events.exportCsv(eventId)}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {event.status === 'in_progress' && sittingOut.length > 0 && (
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

      <FullSchedule matches={event.matches} onScoreMatch={setScoringMatchId} />

      <RoundRobinScoreDialog
        match={scoringMatch}
        open={!!scoringMatch}
        onOpenChange={(open) => {
          if (!open) setScoringMatchId(null);
        }}
        onSubmitScore={submitScore}
      />

      <StandingsTable standings={event.standings} />
    </div>
  );
}

function applyOptimisticRoundRobinScore(
  event: EventDetail,
  match: MatchDetail,
  team1Score: number,
  team2Score: number,
  confirm: boolean
): EventDetail {
  const status = confirm ? 'completed' : 'in_progress';
  const nextEvent: EventDetail = {
    ...event,
    matches: event.matches.map((m) =>
      m.id === match.id
        ? {
            ...m,
            team1Score,
            team2Score,
            status,
            completedAt: confirm ? new Date().toISOString() : null,
          }
        : m
    ),
  };

  if (!confirm || match.status === 'completed' || !match.team1Id || !match.team2Id) {
    return nextEvent;
  }

  const team1Won = team1Score > team2Score;
  const team2Won = team2Score > team1Score;

  return {
    ...nextEvent,
    standings: nextEvent.standings.map((standing) => {
      if (standing.teamId === match.team1Id) {
        return {
          ...standing,
          wins: standing.wins + (team1Won ? 1 : 0),
          losses: standing.losses + (team1Won ? 0 : 1),
          pointsFor: standing.pointsFor + team1Score,
          pointsAgainst: standing.pointsAgainst + team2Score,
        };
      }

      if (standing.teamId === match.team2Id) {
        return {
          ...standing,
          wins: standing.wins + (team2Won ? 1 : 0),
          losses: standing.losses + (team2Won ? 0 : 1),
          pointsFor: standing.pointsFor + team2Score,
          pointsAgainst: standing.pointsAgainst + team1Score,
        };
      }

      return standing;
    }),
  };
}

function RoundRobinScoreDialog({
  match,
  open,
  onOpenChange,
  onSubmitScore,
}: {
  match: MatchDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitScore: (match: MatchDetail, confirm: boolean, scores: { t1: number; t2: number }) => Promise<void>;
}) {
  const [t1, setT1] = useState(0);
  const [t2, setT2] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match) {
      setT1(match.team1Score);
      setT2(match.team2Score);
    }
  }, [match]);

  if (!match) return null;

  const handleSubmit = async (confirm: boolean) => {
    setSaving(true);
    try {
      onOpenChange(false);
      await onSubmitScore(match, confirm, { t1, t2 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Score Match</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <ScoreRow
            name={match.team1 ? getTeamName(match.team1) : 'Team 1'}
            score={t1}
            onMinus={() => setT1(Math.max(0, t1 - 1))}
            onPlus={() => setT1(t1 + 1)}
            disabled={saving}
          />
          <div className="text-center text-xs text-muted-foreground font-medium">VS</div>
          <ScoreRow
            name={match.team2 ? getTeamName(match.team2) : 'Team 2'}
            score={t2}
            onMinus={() => setT2(Math.max(0, t2 - 1))}
            onPlus={() => setT2(t2 + 1)}
            disabled={saving}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSubmit(false)} disabled={saving}>
            Save Draft
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={saving}>
            <Check className="h-4 w-4" /> Complete Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function FullSchedule({
  matches,
  onScoreMatch,
}: {
  matches: MatchDetail[];
  onScoreMatch: (matchId: string) => void;
}) {
  const roundSections = getRoundSections(matches);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Full Schedule</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto">
        {roundSections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches scheduled.</p>
        ) : (
          roundSections.map((section) => (
            <div key={section.round} className="space-y-2">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold">Round {section.round}</h3>
              </div>
              <div className="space-y-2">
                {section.matches.map((match) => (
                  <ScheduleMatchRow
                    key={match.id}
                    match={match}
                    onScoreMatch={onScoreMatch}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleMatchRow({
  match,
  onScoreMatch,
}: {
  match: MatchDetail;
  onScoreMatch: (matchId: string) => void;
}) {
  const isComplete = match.status === 'completed';

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 font-medium">
        <span className="break-words">{match.team1 ? getTeamName(match.team1) : 'TBD'}</span>
        <span className="mx-2 text-muted-foreground">vs</span>
        <span className="break-words">{match.team2 ? getTeamName(match.team2) : 'TBD'}</span>
      </div>
      <div className="flex items-center justify-end">
        {isComplete ? (
          <span className="font-semibold tabular-nums">
            {match.team1Score} - {match.team2Score}
          </span>
        ) : (
          <Button size="sm" onClick={() => onScoreMatch(match.id)}>Score</Button>
        )}
      </div>
    </div>
  );
}

function getRoundSections(matches: MatchDetail[]) {
  const rounds = new Map<number, MatchDetail[]>();
  matches.forEach((match) => {
    const roundMatches = rounds.get(match.round) || [];
    roundMatches.push(match);
    rounds.set(match.round, roundMatches);
  });

  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => {
      return {
        round,
        matches: roundMatches.sort(compareQueueOrder),
      };
    });
}

function compareQueueOrder(a: MatchDetail, b: MatchDetail) {
  return (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0);
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
