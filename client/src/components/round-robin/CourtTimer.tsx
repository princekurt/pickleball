import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CourtTimerProps {
  durationMinutes: number;
}

export function CourtTimer({ durationMinutes }: CourtTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [running, secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft <= 60;

  return (
    <button
      type="button"
      onClick={() => setRunning(!running)}
      className={`flex items-center gap-2 text-sm font-mono ${isLow ? 'text-red-500' : 'text-muted-foreground'}`}
    >
      <Clock className="h-4 w-4" />
      {mins}:{secs.toString().padStart(2, '0')}
      {!running && secondsLeft === durationMinutes * 60 && (
        <span className="text-xs">(tap to start)</span>
      )}
    </button>
  );
}
