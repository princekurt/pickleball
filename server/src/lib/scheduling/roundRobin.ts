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

type CircleSlot<T> = T | null;

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
  const teams = skillBalanced
    ? balanceTeams(players)
    : players.reduce<TeamPair[]>((acc, player, index) => {
        if (index % 2 === 0) {
          acc.push({ player1Id: player.id, player2Id: players[index + 1]?.id });
        }
        return acc;
      }, []);

  return generateFixedDoublesRoundRobin(teams, numCourts, sitOutCounts);
}

/** Generate round robin schedule for fixed doubles teams */
export function generateFixedDoublesRoundRobin(
  teams: TeamPair[],
  numCourts: number,
  sitOutCounts: Record<string, number> = {}
): RoundSchedule[] {
  return buildCircleSchedule(teams, numCourts, sitOutCounts, (team) =>
    [team.player1Id, team.player2Id].filter(Boolean) as string[]
  );
}

/** Generate round robin for singles */
export function generateSinglesRoundRobin(
  players: PlayerInfo[],
  numCourts: number,
  sitOutCounts: Record<string, number> = {}
): RoundSchedule[] {
  const singlesTeams = players.map((player) => ({ player1Id: player.id }));
  return buildCircleSchedule(singlesTeams, numCourts, sitOutCounts, (team) => [team.player1Id]);
}

function buildCircleSchedule(
  teams: TeamPair[],
  numCourts: number,
  sitOutCounts: Record<string, number>,
  getParticipantIds: (team: TeamPair) => string[]
): RoundSchedule[] {
  const rounds: RoundSchedule[] = [];
  if (teams.length < 2) return rounds;

  const slots: CircleSlot<TeamPair>[] = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const totalRounds = slots.length - 1;
  const allIds = teams.flatMap(getParticipantIds);

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const playingIds = new Set<string>();
    const courts: CourtAssignment[] = [];

    for (let i = 0; i < slots.length / 2; i++) {
      const team1 = slots[i];
      const team2 = slots[slots.length - 1 - i];
      if (!team1 || !team2) continue;

      courts.push({
        courtIndex: courts.length % Math.max(1, numCourts),
        team1,
        team2,
      });

      getParticipantIds(team1).forEach((id) => playingIds.add(id));
      getParticipantIds(team2).forEach((id) => playingIds.add(id));
    }

    const sittingOut = allIds.filter((id) => !playingIds.has(id));
    sittingOut.sort((a, b) => (sitOutCounts[a] || 0) - (sitOutCounts[b] || 0));

    rounds.push({ round: roundIndex + 1, courts, sittingOut });

    sittingOut.forEach((id) => {
      sitOutCounts[id] = (sitOutCounts[id] || 0) + 1;
    });

    const moved = slots.pop();
    if (moved !== undefined) slots.splice(1, 0, moved);
  }

  return rounds;
}

export function getTeamDisplayName(
  team: { player1: { name: string }; player2?: { name: string } | null; name?: string | null }
): string {
  if (team.name) return team.name;
  if (team.player2) return `${team.player1.name} & ${team.player2.name}`;
  return team.player1.name;
}
