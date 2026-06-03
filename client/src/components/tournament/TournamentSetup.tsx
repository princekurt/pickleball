import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PartnerSelection,
  toPlayerIds,
  type PartnerPair,
} from '@/components/shared/PartnerSelection';
import { MatchupSelection, type Matchup, type MatchupTeam } from '@/components/shared/MatchupSelection';
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
  const [selectingPartners, setSelectingPartners] = useState(false);
  const [selectingMatchups, setSelectingMatchups] = useState(false);
  const [pendingPairs, setPendingPairs] = useState<PartnerPair[]>();
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

  const selectedPlayers = players.filter((player) => selectedIds.has(player.id));

  const getBracketSize = (numTeams: number) => Math.pow(2, Math.ceil(Math.log2(numTeams)));

  const generateSeedOrder = (bracketSize: number): number[] => {
    if (bracketSize === 2) return [0, 1];
    const half = generateSeedOrder(bracketSize / 2);
    return half.flatMap((seed) => [seed, bracketSize - 1 - seed]);
  };

  const orderTeamsForTournament = <T,>(matchups: Matchup<T>[], allTeams: MatchupTeam<T>[]) => {
    const bracketSize = getBracketSize(allTeams.length);
    const seedOrder = generateSeedOrder(bracketSize);
    const slotToSeedIndex = new Map<number, number>();
    seedOrder.slice(0, allTeams.length).forEach((slot, seedIndex) => {
      slotToSeedIndex.set(slot, seedIndex);
    });
    const playableSlotPairs = Array.from({ length: bracketSize / 2 }, (_, index) => [index * 2, index * 2 + 1] as const)
      .filter(([slotA, slotB]) => slotToSeedIndex.has(slotA) && slotToSeedIndex.has(slotB));
    const orderedTeams = new Array<MatchupTeam<T> | undefined>(allTeams.length);
    const matchedIds = new Set<string>();

    matchups.forEach(([teamA, teamB], index) => {
      const slotPair = playableSlotPairs[index];
      if (!slotPair) return;
      const teamASeedIndex = slotToSeedIndex.get(slotPair[0]);
      const teamBSeedIndex = slotToSeedIndex.get(slotPair[1]);
      if (teamASeedIndex === undefined || teamBSeedIndex === undefined) return;
      if (teamASeedIndex >= 0 && teamASeedIndex < orderedTeams.length) orderedTeams[teamASeedIndex] = teamA;
      if (teamBSeedIndex >= 0 && teamBSeedIndex < orderedTeams.length) orderedTeams[teamBSeedIndex] = teamB;
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
    });

    const remainingTeams = allTeams.filter((team) => !matchedIds.has(team.id));
    return orderedTeams.map((team) => team ?? remainingTeams.shift()).filter(Boolean) as MatchupTeam<T>[];
  };

  const getTournamentMatchupCount = (numTeams: number) => {
    const bracketSize = getBracketSize(numTeams);
    const seedOrder = generateSeedOrder(bracketSize);
    const assignedSlots = new Set(seedOrder.slice(0, numTeams));
    return Array.from({ length: bracketSize / 2 }, (_, index) => [index * 2, index * 2 + 1] as const)
      .filter(([slotA, slotB]) => assignedSlots.has(slotA) && assignedSlots.has(slotB)).length;
  };

  const startTournament = async (manualPairs?: PartnerPair[]) => {
    const minPlayers = format === 'doubles' ? 4 : 2;
    if (selectedIds.size < minPlayers) {
      toast({ title: `Need at least ${minPlayers} players`, variant: 'destructive' });
      return;
    }
    if (format === 'doubles' && manualPairs && selectedIds.size % 2 !== 0) {
      toast({ title: 'Doubles requires an even number of players', variant: 'destructive' });
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
        playerIds: manualPairs ? toPlayerIds(manualPairs) : [...selectedIds],
        partnerPairs: manualPairs,
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

  const startWithMatchups = (matchups: Matchup<PartnerPair>[]) => {
    if (!pendingPairs) return;

    const teams = pendingPairs.map((pair) => ({
      id: pair.join(':'),
      name: pair.join(':'),
      payload: pair,
    }));
    const orderedPairs = orderTeamsForTournament(matchups, teams).map((team) => team.payload);
    void startTournament(orderedPairs);
  };

  const handleStart = () => {
    const minPlayers = format === 'doubles' ? 4 : 2;
    if (selectedIds.size < minPlayers) {
      toast({ title: `Need at least ${minPlayers} players`, variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Enter a tournament name', variant: 'destructive' });
      return;
    }
    if (format === 'doubles') {
      if (selectedIds.size % 2 !== 0) {
        toast({ title: 'Doubles requires an even number of players', variant: 'destructive' });
        return;
      }
      setSelectingPartners(true);
      return;
    }
    void startTournament();
  };

  if (selectingPartners) {
    return (
      <PartnerSelection
        players={selectedPlayers}
        title="Choose Doubles Partners"
        description="Pair each selected player with their doubles partner before creating the bracket."
        confirmLabel="Create Tournament"
        loading={loading}
        onBack={() => setSelectingPartners(false)}
        onConfirm={(pairs) => {
          setPendingPairs(pairs);
          setSelectingPartners(false);
          setSelectingMatchups(true);
        }}
      />
    );
  }

  if (selectingMatchups && pendingPairs) {
    const matchupTeams = pendingPairs.map((pair) => {
      const player1 = players.find((player) => player.id === pair[0]);
      const player2 = players.find((player) => player.id === pair[1]);
      return {
        id: pair.join(':'),
        name: `${player1?.name ?? 'Player'} & ${player2?.name ?? 'Player'}`,
        payload: pair,
      };
    });

    return (
      <MatchupSelection
        teams={matchupTeams}
        title="Choose Matchups"
        description="Choose which teams play against each other before creating the bracket."
        confirmLabel="Create Tournament"
        matchupLabel="Match"
        maxMatchups={getTournamentMatchupCount(matchupTeams.length)}
        loading={loading}
        onBack={() => {
          setSelectingMatchups(false);
          setSelectingPartners(true);
        }}
        onConfirm={startWithMatchups}
      />
    );
  }

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
