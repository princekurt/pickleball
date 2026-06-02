import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api';
import { getTeamName } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { MatchDetail } from '@/types';

interface MatchScoreDialogProps {
  match: MatchDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}

export function MatchScoreDialog({ match, open, onOpenChange, onSubmitted }: MatchScoreDialogProps) {
  const [t1, setT1] = useState(0);
  const [t2, setT2] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (match) {
      setT1(match.team1Score);
      setT2(match.team2Score);
    }
  }, [match]);

  if (!match) return null;

  const handleSubmit = async (confirm: boolean) => {
    setSaving(true);
    try {
      await api.matches.submitScore(match.id, { team1Score: t1, team2Score: t2, confirm });
      toast({ title: confirm ? 'Match completed!' : 'Score updated' });
      onOpenChange(false);
      onSubmitted();
    } catch {
      toast({ title: 'Error', description: 'Failed to submit score', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Match Score
            <StatusBadge status={match.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <ScoreControl
            label={match.team1 ? getTeamName(match.team1) : 'Team 1'}
            score={t1}
            onChange={setT1}
          />
          <div className="text-center text-muted-foreground font-medium">VS</div>
          <ScoreControl
            label={match.team2 ? getTeamName(match.team2) : 'Team 2'}
            score={t2}
            onChange={setT2}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSubmit(false)} disabled={saving}>
            Save Draft
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={saving}>
            {saving ? 'Submitting...' : 'Complete Match'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreControl({ label, score, onChange }: { label: string; score: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex-1 font-medium truncate">{label}</span>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => onChange(Math.max(0, score - 1))}>
          <Minus className="h-6 w-6" />
        </Button>
        <span className="text-4xl font-bold w-14 text-center tabular-nums">{score}</span>
        <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => onChange(score + 1)}>
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
