export interface BracketTeam {
  id: string;
  seed: number;
}

export interface BracketMatch {
  round: number;
  bracketPosition: number;
  bracket: 'winners' | 'losers';
  team1Seed?: number;
  team2Seed?: number;
}

export function getBracketSize(numTeams: number): number {
  return Math.pow(2, Math.ceil(Math.log2(numTeams)));
}

export function seedTeams(
  teams: BracketTeam[],
  method: 'manual' | 'random' | 'skill'
): BracketTeam[] {
  if (method === 'random') {
    return [...teams].sort(() => Math.random() - 0.5).map((t, i) => ({ ...t, seed: i + 1 }));
  }
  return [...teams].sort((a, b) => a.seed - b.seed);
}

export function generateSingleEliminationBracket(numTeams: number): BracketMatch[] {
  const bracketSize = getBracketSize(numTeams);
  const numRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];

  for (let round = 1; round <= numRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({
        round,
        bracketPosition: pos,
        bracket: 'winners',
      });
    }
  }

  return matches;
}

export function generateDoubleEliminationBracket(numTeams: number): BracketMatch[] {
  const winnersMatches = generateSingleEliminationBracket(numTeams);
  const bracketSize = getBracketSize(numTeams);
  const numLosersRounds = Math.log2(bracketSize) * 2 - 2;
  const losersMatches: BracketMatch[] = [];

  for (let round = 1; round <= numLosersRounds; round++) {
    const matchesInRound = Math.max(1, Math.floor(bracketSize / Math.pow(2, Math.ceil(round / 2) + 1)));
    for (let pos = 0; pos < matchesInRound; pos++) {
      losersMatches.push({
        round,
        bracketPosition: pos,
        bracket: 'losers',
      });
    }
  }

  // Grand final
  losersMatches.push({
    round: numLosersRounds + 1,
    bracketPosition: 0,
    bracket: 'losers',
  });

  return [...winnersMatches, ...losersMatches];
}

export function assignTeamsToFirstRound(
  teams: BracketTeam[],
  bracketSize: number
): Map<number, string> {
  const assignment = new Map<number, string>();
  const seeded = seedTeams(teams, 'manual');

  // Standard bracket seeding: 1 vs 16, 8 vs 9, etc.
  const seedOrder = generateSeedOrder(bracketSize);

  seeded.forEach((team, index) => {
    if (index < seedOrder.length) {
      assignment.set(seedOrder[index], team.id);
    }
  });

  return assignment;
}

function generateSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 2) return [0, 1];
  const half = generateSeedOrder(bracketSize / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(bracketSize - 1 - seed);
  }
  return result;
}

export function getByeCount(numTeams: number): number {
  const bracketSize = getBracketSize(numTeams);
  return bracketSize - numTeams;
}
