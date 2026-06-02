import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getTeamName } from '@/lib/utils';
import { api } from '@/lib/api';
import type { EventSummary, MatchDetail } from '@/types';

export function HistoryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchDetail[]>([]);

  useEffect(() => {
    api.events.list().then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      api.events.history(selectedEventId).then(setMatches).catch(() => {});
    }
  }, [selectedEventId]);

  return (
    <div className="md:ml-56 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game History</h1>
        <p className="text-muted-foreground">View past events and match results.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Events</h2>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events yet.</p>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedEventId === event.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <p className="font-medium text-sm">{event.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={event.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedEventId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Match History</h2>
                <Link
                  to={events.find((e) => e.id === selectedEventId)?.type === 'round_robin'
                    ? `/round-robin/${selectedEventId}`
                    : `/tournament/${selectedEventId}`}
                  className="text-sm text-primary hover:underline"
                >
                  View Event
                </Link>
              </div>
              {matches.length === 0 ? (
                <p className="text-muted-foreground text-sm">No completed matches.</p>
              ) : (
                matches.map((match) => (
                  <Card key={match.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className={match.team1Score > match.team2Score ? 'font-semibold' : ''}>
                          {match.team1 ? getTeamName(match.team1) : 'TBD'}
                        </span>
                        <span className="mx-2 text-muted-foreground">
                          {match.team1Score} - {match.team2Score}
                        </span>
                        <span className={match.team2Score > match.team1Score ? 'font-semibold' : ''}>
                          {match.team2 ? getTeamName(match.team2) : 'TBD'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        R{match.round}
                        {match.completedAt && ` · ${new Date(match.completedAt).toLocaleTimeString()}`}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select an event to view match history
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
