import { getTeamName } from '@/lib/utils';
import type { MatchDetail } from '@/types';

interface BracketViewProps {
  matches: MatchDetail[];
  onMatchClick: (match: MatchDetail) => void;
}

export function BracketView({ matches, onMatchClick }: BracketViewProps) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const maxRound = Math.max(...rounds, 1);

  return (
    <div className="flex gap-8 min-w-max p-4 print:block">
      {rounds.map((round) => {
        const roundMatches = matches.filter((m) => m.round === round);
        const spacing = Math.pow(2, round - 1) * 60;

        return (
          <div key={round} className="flex flex-col min-w-[200px]">
            <h4 className="text-xs font-semibold text-muted-foreground mb-4 text-center">
              {round === maxRound ? 'Final' : round === maxRound - 1 ? 'Semifinals' : `Round ${round}`}
            </h4>
            <div className="flex flex-col justify-around flex-1" style={{ gap: spacing }}>
              {roundMatches.map((match) => (
                <BracketMatch key={match.id} match={match} onClick={() => onMatchClick(match)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BracketMatch({ match, onClick }: { match: MatchDetail; onClick: () => void }) {
  const isComplete = match.status === 'completed';
  const team1Won = isComplete && match.team1Score > match.team2Score;
  const team2Won = isComplete && match.team2Score > match.team1Score;
  const hasTeams = match.team1Id && match.team2Id;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasTeams}
      className={`w-full rounded-lg border text-left text-sm transition-all hover:shadow-md ${
        isComplete ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'hover:border-primary'
      } ${!hasTeams ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
    >
      <div className={`px-3 py-2 border-b ${team1Won ? 'font-semibold text-green-700 dark:text-green-400' : ''}`}>
        <span className="truncate block">
          {match.team1 ? getTeamName(match.team1) : 'TBD'}
        </span>
        {isComplete && <span className="float-right font-mono">{match.team1Score}</span>}
      </div>
      <div className={`px-3 py-2 ${team2Won ? 'font-semibold text-green-700 dark:text-green-400' : ''}`}>
        <span className="truncate block">
          {match.team2 ? getTeamName(match.team2) : 'TBD'}
        </span>
        {isComplete && <span className="float-right font-mono">{match.team2Score}</span>}
      </div>
      {!isComplete && hasTeams && (
        <div className="px-3 py-1 text-xs text-blue-500 border-t">Click to score</div>
      )}
    </button>
  );
}
