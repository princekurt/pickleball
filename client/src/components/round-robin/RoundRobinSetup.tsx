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

export function RoundRobinSetup() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('Open Play Session');
  const [numCourts, setNumCourts] = useState('2');
  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [skillBalanced, setSkillBalanced] = useState(true);
  const [scoringType, setScoringType] = useState<'score' | 'time'>('score');
  const [targetScore, setTargetScore] = useState('11');
  const [gameDuration, setGameDuration] = useState('15');
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

  const selectAll = () => setSelectedIds(new Set(players.map((p) => p.id)));

  const handleStart = async () => {
    if (selectedIds.size < 4) {
      toast({ title: 'Need at least 4 players', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const event = await api.roundRobin.setup({
        name,
        playerIds: [...selectedIds],
        numCourts: parseInt(numCourts),
        format,
        skillBalanced,
        scoringType,
        targetScore: parseInt(targetScore),
        gameDuration: scoringType === 'time' ? parseInt(gameDuration) : undefined,
      });
      toast({ title: 'Round Robin started!' });
      navigate(`/round-robin/${event.id}`);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to start', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
          <CardDescription>Configure your round robin session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Session Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Courts</Label>
              <Select value={numCourts} onValueChange={setNumCourts}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} court{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scoring</Label>
              <Select value={scoringType} onValueChange={(v) => setScoringType(v as 'score' | 'time')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score-based</SelectItem>
                  <SelectItem value="time">Time-based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scoringType === 'score' ? (
              <div className="space-y-2">
                <Label>Target Score</Label>
                <Select value={targetScore} onValueChange={setTargetScore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[7, 11, 15, 21].map((n) => (
                      <SelectItem key={n} value={n.toString()}>First to {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Select value={gameDuration} onValueChange={setGameDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 12, 15, 20].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {format === 'doubles' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skillBalanced} onChange={(e) => setSkillBalanced(e.target.checked)} className="rounded" />
              <span className="text-sm">Skill-balanced team generation</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Players</CardTitle>
              <CardDescription>{selectedIds.size} selected (minimum 4)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayer(player.id)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedIds.has(player.id)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                <span className="font-medium truncate">{player.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{player.skillLevel.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={handleStart} disabled={loading || selectedIds.size < 4}>
        {loading ? 'Starting...' : 'Start Round Robin'}
      </Button>
    </div>
  );
}
