import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Minus, Plus, Check, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CourtTimer } from './CourtTimer';
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

  const moveUpcomingMatch = async (matchId: string, direction: 'up' | 'down') => {
    if (!event) return;

    const match = event.matches.find((m) => m.id === matchId);
    if (!match || !isUpcomingQueuedMatch(match)) return;

    const queueCourtId = getQueueCourtId(match, event.courts);
    const courtQueue = event.matches
      .filter((m) => isUpcomingQueuedMatch(m) && getQueueCourtId(m, event.courts) === queueCourtId)
      .sort(compareQueueOrder);
    const currentIndex = courtQueue.findIndex((m) => m.id === matchId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const target = courtQueue[targetIndex];

    if (!target) return;

    const previousEvent = event;
    const nextMatches = event.matches.map((m) => {
      if (m.id === match.id) return { ...m, bracketPosition: target.bracketPosition };
      if (m.id === target.id) return { ...m, bracketPosition: match.bracketPosition };
      return m;
    });

    setEvent({ ...event, matches: nextMatches });

    try {
      await Promise.all([
        api.matches.update(match.id, { bracketPosition: target.bracketPosition }),
        api.matches.update(target.id, { bracketPosition: match.bracketPosition }),
      ]);
    } catch {
      setEvent(previousEvent);
      toast({ title: 'Error', description: 'Failed to reorder match queue', variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!event) return <div className="text-center py-12">Event not found</div>;

  const activeMatches = event.matches.filter((m) => m.status !== 'completed' && m.courtId);
  const currentRound = activeMatches.length > 0 ? Math.min(...activeMatches.map((m) => m.round)) : config.currentRound || 1;
  const sittingOut = getSittingOutPlayers(event, activeMatches);

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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {activeMatches.map((match) => (
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

      <FullSchedule matches={event.matches} courts={event.courts} onMoveMatch={moveUpcomingMatch} />

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

function FullSchedule({
  matches,
  courts,
  onMoveMatch,
}: {
  matches: MatchDetail[];
  courts: EventDetail['courts'];
  onMoveMatch: (matchId: string, direction: 'up' | 'down') => void;
}) {
  const upcomingQueues = getUpcomingQueues(matches, courts);
  const activeRounds = getActiveRoundSections(matches, courts);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Full Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeRounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">All matches completed.</p>
        ) : (
          activeRounds.map((section) => (
            <div key={section.round} className="space-y-2">
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <h3 className="text-sm font-semibold">Round {section.round}</h3>
                <span className="text-xs text-muted-foreground">
                  {section.completed}/{section.total} done
                </span>
              </div>
              <div className="space-y-2">
                {section.matches.map((match) => {
                  const queue = upcomingQueues[getQueueCourtId(match, courts)] || [];
                  const queueIndex = queue.findIndex((m) => m.id === match.id);
                  const movable = isUpcomingQueuedMatch(match);

                  return (
                    <div
                      key={match.id}
                      className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span>{match.team1 ? getTeamName(match.team1) : 'TBD'}</span>
                        <span className="mx-2 text-muted-foreground">vs</span>
                        <span>{match.team2 ? getTeamName(match.team2) : 'TBD'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getMatchCourtName(match, courts)}</span>
                          <StatusBadge status={match.status} />
                        </div>
                        {movable && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onMoveMatch(match.id, 'up')}
                              disabled={queueIndex <= 0}
                              aria-label="Move match up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onMoveMatch(match.id, 'down')}
                              disabled={queueIndex === -1 || queueIndex >= queue.length - 1}
                              aria-label="Move match down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function getActiveRoundSections(matches: MatchDetail[], courts: EventDetail['courts']) {
  const rounds = new Map<number, MatchDetail[]>();
  matches.forEach((match) => {
    const roundMatches = rounds.get(match.round) || [];
    roundMatches.push(match);
    rounds.set(match.round, roundMatches);
  });

  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => {
      const completed = roundMatches.filter((match) => match.status === 'completed').length;
      return {
        round,
        completed,
        total: roundMatches.length,
        matches: roundMatches
          .filter((match) => match.status !== 'completed')
          .sort((a, b) => {
            const courtCompare = getMatchCourtName(a, courts).localeCompare(getMatchCourtName(b, courts));
            if (courtCompare !== 0) return courtCompare;
            return compareQueueOrder(a, b);
          }),
      };
    })
    .filter((section) => section.matches.length > 0);
}

function getUpcomingQueues(matches: MatchDetail[], courts: EventDetail['courts']) {
  return matches.filter(isUpcomingQueuedMatch).reduce<Record<string, MatchDetail[]>>((queues, match) => {
    const courtId = getQueueCourtId(match, courts);
    queues[courtId] = [...(queues[courtId] || []), match].sort(compareQueueOrder);
    return queues;
  }, {});
}

function isUpcomingQueuedMatch(match: MatchDetail) {
  return match.status === 'scheduled' && !match.courtId;
}

function getQueueCourtId(match: MatchDetail, courts: EventDetail['courts']) {
  if (match.courtId) return match.courtId;
  if (courts.length === 0) return 'queued';

  const queuePosition = match.bracketPosition ?? 0;
  return courts[Math.abs(queuePosition) % courts.length]?.id || 'queued';
}

function getMatchCourtName(match: MatchDetail, courts: EventDetail['courts']) {
  if (match.court?.name) return match.court.name;

  const courtId = getQueueCourtId(match, courts);
  return courts.find((court) => court.id === courtId)?.name || 'Queued';
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
