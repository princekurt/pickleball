import { Link } from 'react-router-dom';
import { RotateCcw, Trophy, Users, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { EventSummary } from '@/types';

const quickActions = [
  {
    to: '/round-robin',
    icon: RotateCcw,
    title: 'Start Round Robin',
    description: 'Casual group play with auto-rotation',
    color: 'text-green-600 bg-green-100 dark:bg-green-950',
  },
  {
    to: '/tournament',
    icon: Trophy,
    title: 'New Tournament',
    description: 'Bracket-style competitive play',
    color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950',
  },
  {
    to: '/players',
    icon: Users,
    title: 'Manage Players',
    description: 'Add, edit, and view player stats',
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-950',
  },
];

export function HomePage() {
  const [recentEvents, setRecentEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    api.events.list().then(setRecentEvents).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 md:ml-56">
      <div>
        <h1 className="text-3xl font-bold">Pickleball Tournament Manager</h1>
        <p className="text-muted-foreground mt-1">Manage events, track scores, and run tournaments courtside.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(({ to, icon: Icon, title, description, color }) => (
          <Link key={to} to={to}>
            <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer h-full">
              <CardHeader>
                <div className={`inline-flex p-3 rounded-xl ${color} mb-2`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {recentEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Events</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history"><History className="h-4 w-4" /> View All</Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {recentEvents.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                to={event.type === 'round_robin' ? `/round-robin/${event.id}` : `/tournament/${event.id}`}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{event.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.type === 'round_robin' ? 'Round Robin' : 'Tournament'} · {event._count.eventPlayers} players
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
