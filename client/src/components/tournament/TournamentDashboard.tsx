import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BracketView } from './BracketView';
import { MatchScoreDialog } from './MatchScoreDialog';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import type { EventDetail, MatchDetail } from '@/types';

interface TournamentDashboardProps {
  eventId: string;
}

export function TournamentDashboard({ eventId }: TournamentDashboardProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvent = useCallback(async () => {
    try {
      const data = await api.events.get(eventId);
      setEvent(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load tournament', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const eventRealtimeSubscriptions = useMemo(() => [
    { table: 'Player' as const },
    { table: 'Match' as const, filter: `eventId=eq.${eventId}` },
    { table: 'Standing' as const, filter: `eventId=eq.${eventId}` },
  ], [eventId]);

  useSupabaseRealtime(`tournament-${eventId}`, eventRealtimeSubscriptions, fetchEvent);

  const handleSubmitScore = async (
    match: MatchDetail,
    team1Score: number,
    team2Score: number,
    confirm: boolean
  ) => {
    const previousEvent = event;

    if (event) {
      setEvent({
        ...event,
        matches: event.matches.map((m) =>
          m.id === match.id
            ? {
                ...m,
                team1Score,
                team2Score,
                status: confirm ? 'completed' : 'in_progress',
                completedAt: confirm ? new Date().toISOString() : null,
              }
            : m
        ),
      });
    }

    try {
      await api.matches.submitScore(match.id, { team1Score, team2Score, confirm });
      toast({ title: confirm ? 'Match completed!' : 'Score updated' });
      fetchEvent();
    } catch {
      if (previousEvent) setEvent(previousEvent);
      toast({ title: 'Error', description: 'Failed to submit score', variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!event) return <div className="text-center py-12">Tournament not found</div>;

  const config = event.config ? JSON.parse(event.config) : {};
  const completed = event.matches.filter((m) => m.status === 'completed').length;
  const remaining = event.matches.filter((m) => m.status !== 'completed' && m.team1Id && m.team2Id).length;
  const currentRound = Math.max(...event.matches.filter((m) => m.status !== 'completed').map((m) => m.round), 0);
  const isComplete = event.status === 'completed' || remaining === 0;

  const winners = getPodium(event);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {event.location && <span>{event.location}</span>}
            {event.location && event.date && <span>·</span>}
            <span>{new Date(event.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={event.status} />
            <span className="text-sm text-muted-foreground">
              {completed}/{event.matches.length} matches · Round {currentRound || 1}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => api.events.exportCsv(eventId)}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Players" value={event.eventPlayers.length} />
        <StatCard label="Remaining" value={remaining} />
        <StatCard label="Round" value={currentRound || 1} />
      </div>

      {isComplete && winners.length > 0 && (
        <Card className="border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" /> Final Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-8">
              {winners.map((w, i) => (
                <div key={i} className="text-center">
                  <div className={`text-4xl ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-700'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <p className="font-semibold mt-1">{w}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {config.tournamentFormat === 'double_elimination' ? 'Winners Bracket' : 'Bracket'}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <BracketView
            matches={event.matches.filter((m) => m.bracket === 'winners' || !m.bracket)}
            onMatchClick={setSelectedMatch}
          />
        </CardContent>
      </Card>

      {config.tournamentFormat === 'double_elimination' && (
        <Card>
          <CardHeader>
            <CardTitle>Losers Bracket</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <BracketView
              matches={event.matches.filter((m) => m.bracket === 'losers')}
              onMatchClick={setSelectedMatch}
            />
          </CardContent>
        </Card>
      )}

      <MatchScoreDialog
        match={selectedMatch}
        open={!!selectedMatch}
        onOpenChange={(open) => !open && setSelectedMatch(null)}
        onSubmitScore={handleSubmitScore}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function getPodium(event: EventDetail): string[] {
  const finalMatch = event.matches
    .filter((m) => m.status === 'completed' && m.team1Id && m.team2Id)
    .sort((a, b) => b.round - a.round)[0];
  if (!finalMatch) return [];

  const winner = finalMatch.team1Score > finalMatch.team2Score ? finalMatch.team1 : finalMatch.team2;
  const runnerUp = finalMatch.team1Score > finalMatch.team2Score ? finalMatch.team2 : finalMatch.team1;

  const names: string[] = [];
  if (winner) {
    names.push(winner.player2 ? `${winner.player1.name} & ${winner.player2.name}` : winner.player1.name);
  }
  if (runnerUp) {
    names.push(runnerUp.player2 ? `${runnerUp.player1.name} & ${runnerUp.player2.name}` : runnerUp.player1.name);
  }
  return names;
}
