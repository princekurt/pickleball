import { PlayerList } from '@/components/players/PlayerList';

export function PlayersPage() {
  return (
    <div className="md:ml-56 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground">Manage your player roster and view stats.</p>
      </div>
      <PlayerList />
    </div>
  );
}
