import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import type { PlayerWithStats } from '@/types';

export function TournamentSetup() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [tournamentFormat, setTournamentFormat] = useState<'single_elimination' | 'double_elimination'>('single_elimination');
  const [seedingMethod, setSeedingMethod] = useState<'manual' | 'random' | 'skill'>('skill');
  const [bestOf, setBestOf] = useState('1');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    api.players.list().then(setPlayers).catch(() => {});
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    const minPlayers = format === 'doubles' ? 4 : 2;
    if (selectedIds.size < minPlayers) {
      toast({ title: `Need at least ${minPlayers} players`, variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Enter a tournament name', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const event = await api.tournament.setup({
        name: name.trim(),
        date,
        location: location || undefined,
        playerIds: [...selectedIds],
        format,
        tournamentFormat,
        seedingMethod,
        bestOf: parseInt(bestOf),
      });
      toast({ title: 'Tournament created!' });
      navigate(`/tournament/${event.id}`);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tournament Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Classic 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Community Center" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'singles' | 'doubles')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doubles">Doubles</SelectItem>
                  <SelectItem value="singles">Singles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bracket Type</Label>
              <Select value={tournamentFormat} onValueChange={(v) => setTournamentFormat(v as typeof tournamentFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seeding</Label>
              <Select value={seedingMethod} onValueChange={(v) => setSeedingMethod(v as typeof seedingMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skill">By Skill Rating</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Best Of</Label>
              <Select value={bestOf} onValueChange={setBestOf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Best of 1</SelectItem>
                  <SelectItem value="3">Best of 3</SelectItem>
                  <SelectItem value="5">Best of 5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Players</CardTitle>
          <CardDescription>{selectedIds.size} selected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayer(player.id)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedIds.has(player.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <span className="font-medium truncate">{player.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{player.skillLevel.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={handleStart} disabled={loading}>
        {loading ? 'Creating...' : 'Create Tournament'}
      </Button>
    </div>
  );
}
