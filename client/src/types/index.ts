export interface Player {
  id: string;
  name: string;
  skillLevel: number;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerWithStats extends Player {
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    pointsFor: number;
    pointsAgainst: number;
  };
}

export interface Team {
  id: string;
  player1Id: string;
  player2Id?: string | null;
  name?: string | null;
  player1: Player;
  player2?: Player | null;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: 'round_robin' | 'tournament';
  format: 'singles' | 'doubles';
  status: 'setup' | 'in_progress' | 'completed';
  config?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventSummary extends Event {
  _count: { matches: number; eventPlayers: number };
}

export interface EventPlayer {
  id: string;
  eventId: string;
  playerId: string;
  seed?: number | null;
  player: Player;
}

export interface Court {
  id: string;
  name: string;
  eventId?: string | null;
  isActive: boolean;
}

export interface Match {
  id: string;
  eventId: string;
  courtId?: string | null;
  team1Id?: string | null;
  team2Id?: string | null;
  team1Score: number;
  team2Score: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  round: number;
  bracket?: string | null;
  bracketPosition?: number | null;
  scheduledTime?: string | null;
  completedAt?: string | null;
  bestOf: number;
}

export interface MatchDetail extends Match {
  team1?: Team | null;
  team2?: Team | null;
  court?: Court | null;
  event?: Event;
}

export interface Standing {
  id: string;
  eventId: string;
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  sitOuts: number;
  team: Team;
}

export interface EventDetail extends Event {
  eventPlayers: EventPlayer[];
  courts: Court[];
  matches: MatchDetail[];
  standings: Standing[];
}

export interface RoundRobinSetup {
  name?: string;
  playerIds: string[];
  partnerPairs?: [string, string][];
  numCourts: number;
  format: 'singles' | 'doubles';
  skillBalanced?: boolean;
  scoringType?: 'time' | 'score';
  targetScore?: number;
  gameDuration?: number;
}

export interface TournamentSetup {
  name: string;
  date?: string;
  location?: string;
  playerIds: string[];
  partnerPairs?: [string, string][];
  format: 'singles' | 'doubles';
  tournamentFormat: 'single_elimination' | 'double_elimination' | 'round_robin_playoffs';
  seedingMethod: 'manual' | 'random' | 'skill';
  bestOf?: number;
}

export interface BracketData {
  event: EventDetail;
  winnersBracket: MatchDetail[];
  losersBracket: MatchDetail[];
  tournamentFormat: string;
}

export interface RoundRobinConfig {
  numCourts: number;
  skillBalanced: boolean;
  scoringType: 'time' | 'score';
  targetScore: number;
  gameDuration?: number;
  currentRound: number;
  schedule?: number;
  sitOutCounts?: Record<string, number>;
}
