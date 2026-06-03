import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PlayerWithStats } from '@/types';

export type PartnerPair = [string, string];

interface PartnerSelectionProps {
  players: PlayerWithStats[];
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onBack: () => void;
  onConfirm: (pairs: PartnerPair[]) => void;
}

export function PartnerSelection({
  players,
  title,
  description,
  confirmLabel,
  loading,
  onBack,
  onConfirm,
}: PartnerSelectionProps) {
  const [partners, setPartners] = useState<Record<string, string>>({});
  const playerIds = useMemo(() => players.map((player) => player.id), [players]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    setPartners((prev) => {
      const validIds = new Set(playerIds);
      const next: Record<string, string> = {};

      for (const [playerId, partnerId] of Object.entries(prev)) {
        if (validIds.has(playerId) && validIds.has(partnerId)) {
          next[playerId] = partnerId;
        }
      }

      return next;
    });
  }, [playerIds]);

  const setPartner = (playerId: string, partnerId: string) => {
    setPartners((prev) => {
      const next = { ...prev };
      const previousPartner = next[playerId];

      if (previousPartner) {
        delete next[previousPartner];
      }
      if (next[partnerId]) {
        delete next[next[partnerId]];
      }

      next[playerId] = partnerId;
      next[partnerId] = playerId;
      return next;
    });
  };

  const pairs = useMemo(() => {
    const used = new Set<string>();
    const next: PartnerPair[] = [];

    for (const player of players) {
      const partnerId = partners[player.id];
      if (!partnerId || used.has(player.id) || used.has(partnerId)) continue;
      next.push([player.id, partnerId]);
      used.add(player.id);
      used.add(partnerId);
    }

    return next;
  }, [partners, players]);

  const pairedIds = new Set(pairs.flat());
  const unpairedPlayers = players.filter((player) => !pairedIds.has(player.id));
  const canConfirm = players.length >= 4 && players.length % 2 === 0 && unpairedPlayers.length === 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {players.length % 2 !== 0 && (
            <p className="text-sm text-destructive">Doubles requires an even number of selected players.</p>
          )}

          <div className="space-y-3">
            {players.map((player) => {
              const partnerId = partners[player.id];

              return (
                <div key={player.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1.2fr] sm:items-center">
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">Skill {player.skillLevel.toFixed(1)}</p>
                  </div>
                  <Select value={partnerId ?? ''} onValueChange={(value) => setPartner(player.id, value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {players
                        .filter((option) => option.id !== player.id && (!partners[option.id] || partners[option.id] === player.id))
                        .map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {pairs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Teams</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {pairs.map(([player1Id, player2Id]) => (
                  <p key={`${player1Id}-${player2Id}`}>
                    {playerById.get(player1Id)?.name} & {playerById.get(player2Id)?.name}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button className="flex-1" onClick={() => onConfirm(pairs)} disabled={loading || !canConfirm}>
          {loading ? 'Starting...' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export function toPlayerIds(pairs: PartnerPair[]) {
  return pairs.flatMap(([player1Id, player2Id]) => [player1Id, player2Id]);
}
