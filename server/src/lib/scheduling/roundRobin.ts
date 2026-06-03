export interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: number;
}

export interface TeamPair {
  player1Id: string;
  player2Id?: string;
}

export interface CourtAssignment {
  courtIndex: number;
  team1: TeamPair;
  team2: TeamPair;
}

export interface RoundSchedule {
  round: number;
  courts: CourtAssignment[];
  sittingOut: string[];
}

/** Balance players into doubles teams by skill rating */
export function balanceTeams(players: PlayerInfo[]): TeamPair[] {
  const sorted = [...players].sort((a, b) => b.skillLevel - a.skillLevel);
  const teams: TeamPair[] = [];
  let left = 0;
  let right = sorted.length - 1;

  while (left < right) {
    teams.push({
      player1Id: sorted[left].id,
      player2Id: sorted[right].id,
    });
    left++;
    right--;
  }

  if (left === right) {
    teams.push({ player1Id: sorted[left].id });
  }

  return teams;
}

/** Generate round robin schedule for doubles play */
export function generateDoublesRoundRobin(
  players: PlayerInfo[],
  numCourts: number,
  skillBalanced: boolean,
  sitOutCounts: Record<string, number> = {}
): RoundSchedule[] {
  const n = players.length;
  const rounds: RoundSchedule[] = [];

  // Circle method for round robin pairing
  const playerIds = players.map((p) => p.id);
  const totalRounds = n - 1 + (n % 2);

  for (let r = 0; r < Math.min(totalRounds, n); r++) {
    const rotated = rotateArray(playerIds, r);
    const pairs: [string, string][] = [];

    for (let i = 0; i < Math.floor(rotated.length / 2); i++) {
      pairs.push([rotated[i], rotated[rotated.length - 1 - i]]);
    }

    // Form doubles teams from pairs
    const teams: TeamPair[] = [];
    if (skillBalanced) {
      const roundPlayers = pairs.flatMap(([a, b]) => [
        players.find((p) => p.id === a)!,
        players.find((p) => p.id === b)!,
      ]);
      teams.push(...balanceTeams(roundPlayers));
    } else {
      for (let i = 0; i < pairs.length; i += 2) {
        if (i + 1 < pairs.length) {
          teams.push({
            player1Id: pairs[i][0],
            player2Id: pairs[i][1],
          });
          teams.push({
            player1Id: pairs[i + 1][0],
            player2Id: pairs[i + 1][1],
          });
        } else {
          teams.push({ player1Id: pairs[i][0], player2Id: pairs[i][1] });
        }
      }
    }

    const maxMatches = numCourts;
    const maxPlayersOnCourt = maxMatches * 4;
    const playingIds = new Set<string>();
    const courts: CourtAssignment[] = [];
    let teamIdx = 0;

    while (teamIdx + 1 < teams.length && courts.length < maxMatches) {
      courts.push({
        courtIndex: courts.length,
        team1: teams[teamIdx],
        team2: teams[teamIdx + 1],
      });
      [teams[teamIdx], teams[teamIdx + 1]].forEach((t) => {
        playingIds.add(t.player1Id);
        if (t.player2Id) playingIds.add(t.player2Id);
      });
      teamIdx += 2;
    }

    const allIds = new Set(playerIds);
    let sittingOut = [...allIds].filter((id) => !playingIds.has(id));

    // Prioritize players who have sat out the most
    sittingOut.sort((a, b) => (sitOutCounts[b] || 0) - (sitOutCounts[a] || 0));

    // If too many players, rotate extras in
    if (playingIds.size > maxPlayersOnCourt) {
      // handled by court limit above
    }

    rounds.push({
      round: r + 1,
      courts,
      sittingOut,
    });

    sittingOut.forEach((id) => {
      sitOutCounts[id] = (sitOutCounts[id] || 0) + 1;
    });
  }

  return rounds;
}

/** Generate round robin schedule for fixed doubles teams */
export function generateFixedDoublesRoundRobin(
  teams: TeamPair[],
  numCourts: number,
  sitOutCounts: Record<string, number> = {}
): RoundSchedule[] {
  const teamCount = teams.length;
  const rounds: RoundSchedule[] = [];
  const teamIndexes = teams.map((_, index) => index);
  const totalRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;

  for (let r = 0; r < totalRounds; r++) {
    const rotated = rotateArray(teamIndexes, r);
    const playingIds = new Set<string>();
    const courts: CourtAssignment[] = [];

    for (let i = 0; i < Math.floor(rotated.length / 2) && courts.length < numCourts; i++) {
      const team1 = teams[rotated[i]];
      const team2 = teams[rotated[rotated.length - 1 - i]];
      if (!team1 || !team2) continue;

      courts.push({
        courtIndex: courts.length,
        team1,
        team2,
      });

      [team1, team2].forEach((team) => {
        playingIds.add(team.player1Id);
        if (team.player2Id) playingIds.add(team.player2Id);
      });
    }

    const allIds = teams.flatMap((team) => [team.player1Id, team.player2Id].filter(Boolean) as string[]);
    const sittingOut = allIds.filter((id) => !playingIds.has(id));
    sittingOut.sort((a, b) => (sitOutCounts[b] || 0) - (sitOutCounts[a] || 0));

    rounds.push({
      round: r + 1,
      courts,
      sittingOut,
    });

    sittingOut.forEach((id) => {
      sitOutCounts[id] = (sitOutCounts[id] || 0) + 1;
    });
  }

  return rounds;
}

/** Generate round robin for singles */
export function generateSinglesRoundRobin(
  players: PlayerInfo[],
  numCourts: number,
  sitOutCounts: Record<string, number> = {}
): RoundSchedule[] {
  const n = players.length;
  const playerIds = players.map((p) => p.id);
  const rounds: RoundSchedule[] = [];
  const totalRounds = n % 2 === 0 ? n - 1 : n;

  for (let r = 0; r < totalRounds; r++) {
    const rotated = rotateArray(playerIds, r);
    const pairs: [string, string][] = [];

    for (let i = 0; i < Math.floor(rotated.length / 2); i++) {
      pairs.push([rotated[i], rotated[rotated.length - 1 - i]]);
    }

    const playingIds = new Set<string>();
    const courts: CourtAssignment[] = [];

    for (let i = 0; i < Math.min(pairs.length, numCourts); i++) {
      courts.push({
        courtIndex: i,
        team1: { player1Id: pairs[i][0] },
        team2: { player1Id: pairs[i][1] },
      });
      playingIds.add(pairs[i][0]);
      playingIds.add(pairs[i][1]);
    }

    let sittingOut = playerIds.filter((id) => !playingIds.has(id));
    sittingOut.sort((a, b) => (sitOutCounts[b] || 0) - (sitOutCounts[a] || 0));

    rounds.push({ round: r + 1, courts, sittingOut });

    sittingOut.forEach((id) => {
      sitOutCounts[id] = (sitOutCounts[id] || 0) + 1;
    });
  }

  return rounds;
}

function rotateArray<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  const result = [...arr];
  for (let i = 0; i < shift; i++) {
    const last = result.pop()!;
    result.unshift(last);
  }
  return result;
}

export function getTeamDisplayName(
  team: { player1: { name: string }; player2?: { name: string } | null; name?: string | null }
): string {
  if (team.name) return team.name;
  if (team.player2) return `${team.player1.name} & ${team.player2.name}`;
  return team.player1.name;
}
