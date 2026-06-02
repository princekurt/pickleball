import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/shared/Avatar';
import { PlayerFormDialog } from './PlayerFormDialog';
import { DeletePlayerDialog } from './DeletePlayerDialog';
import { api } from '@/lib/api';
import { usePlayerStore } from '@/store';
import { useToast } from '@/hooks/useToast';
import { SKILL_LEVELS } from '@/lib/utils';
import type { PlayerWithStats } from '@/types';

export function PlayerList() {
  const { players, search, skillFilter, setPlayers, setSearch, setSkillFilter, setLoading, loading } = usePlayerStore();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStats | null>(null);
  const { toast } = useToast();

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const data = await api.players.list({
        search: search || undefined,
        skillLevel: skillFilter ?? undefined,
      });
      setPlayers(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load players', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [search, skillFilter]);

  const handleEdit = (player: PlayerWithStats) => {
    setSelectedPlayer(player);
    setFormOpen(true);
  };

  const handleDelete = (player: PlayerWithStats) => {
    setSelectedPlayer(player);
    setDeleteOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedPlayer(null);
    fetchPlayers();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={skillFilter?.toString() ?? 'all'}
            onValueChange={(v) => setSkillFilter(v === 'all' ? null : parseFloat(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {SKILL_LEVELS.map((level) => (
                <SelectItem key={level} value={level.toString()}>{level.toFixed(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setSelectedPlayer(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Player
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading players...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No players found. Add your first player!</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <Card key={player.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={player.name} avatarUrl={player.avatarUrl} />
                    <div>
                      <CardTitle className="text-base">{player.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">Skill: {player.skillLevel.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(player)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(player)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="font-semibold text-lg">{player.stats.gamesPlayed}</p>
                    <p className="text-muted-foreground text-xs">Games</p>
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-green-600">{player.stats.wins}</p>
                    <p className="text-muted-foreground text-xs">Wins</p>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{player.stats.winRate}%</p>
                    <p className="text-muted-foreground text-xs">Win Rate</p>
                  </div>
                </div>
                {(player.email || player.phone) && (
                  <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                    {player.email && <p>{player.email}</p>}
                    {player.phone && <p>{player.phone}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlayerFormDialog open={formOpen} onOpenChange={handleFormClose} player={selectedPlayer} />
      <DeletePlayerDialog open={deleteOpen} onOpenChange={setDeleteOpen} player={selectedPlayer} onDeleted={fetchPlayers} />
    </div>
  );
}
