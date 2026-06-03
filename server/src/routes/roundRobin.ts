import { Router } from 'express';
import prisma from '../lib/prisma.js';
import {
  generateDoublesRoundRobin,
  generateFixedDoublesRoundRobin,
  generateSinglesRoundRobin,
} from '../lib/scheduling/roundRobin.js';

export const roundRobinRouter = Router();

roundRobinRouter.post('/setup', async (req, res) => {
  try {
    const {
      name,
      playerIds,
      numCourts,
      format,
      skillBalanced,
      scoringType,
      targetScore,
      gameDuration,
      partnerPairs,
    } = req.body;

    const manualTeams =
      format === 'doubles' && Array.isArray(partnerPairs)
        ? partnerPairs.map(([player1Id, player2Id]: [string, string]) => ({ player1Id, player2Id }))
        : undefined;

    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });

    if (players.length < 4) {
      return res.status(400).json({ error: 'Minimum 4 players required' });
    }

    const event = await prisma.event.create({
      data: {
        name: name || 'Round Robin Session',
        type: 'round_robin',
        format,
        status: 'setup',
        config: JSON.stringify({
          numCourts,
          skillBalanced,
          scoringType,
          targetScore: targetScore || 11,
          gameDuration,
          currentRound: 0,
          sitOutCounts: {},
          partnerPairs: manualTeams,
        }),
      },
    });

    // Add players to event
    await prisma.eventPlayer.createMany({
      data: playerIds.map((playerId: string, index: number) => ({
        eventId: event.id,
        playerId,
        seed: index + 1,
      })),
    });

    // Create courts
    const courts = await Promise.all(
      Array.from({ length: numCourts }, (_, i) =>
        prisma.court.create({
          data: { name: `Court ${i + 1}`, eventId: event.id, isActive: true },
        })
      )
    );

    // Generate schedule
    const config = JSON.parse(event.config || '{}');
    const schedule =
      format === 'doubles'
        ? manualTeams
          ? generateFixedDoublesRoundRobin(manualTeams, numCourts)
          : generateDoublesRoundRobin(players, numCourts, skillBalanced)
        : generateSinglesRoundRobin(players, numCourts);

    // Create the complete queue up front and assign the first available courts.
    await createQueuedMatches(event.id, schedule, courts, format);

    await prisma.event.update({
      where: { id: event.id },
      data: {
        status: schedule.length > 0 ? 'in_progress' : 'completed',
        config: JSON.stringify({
          ...config,
          currentRound: 1,
          schedule: schedule.length,
          totalMatches: schedule.reduce((total, round) => total + round.courts.length, 0),
        }),
      },
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        eventPlayers: { include: { player: true } },
        courts: true,
        matches: {
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
            court: true,
          },
          orderBy: [{ round: 'asc' }, { bracketPosition: 'asc' }],
        },
        standings: {
          include: { team: { include: { player1: true, player2: true } } },
        },
      },
    });

    res.status(201).json(fullEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to setup round robin' });
  }
});

roundRobinRouter.post('/:eventId/next-round', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: {
        eventPlayers: { include: { player: true } },
        courts: true,
        matches: { where: { status: { not: 'completed' } } },
      },
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const queuedMatches = await prisma.match.findMany({
      where: { eventId: event.id, status: 'scheduled', courtId: null },
      orderBy: [{ bracketPosition: 'asc' }],
      include: {
        team1: true,
        team2: true,
      },
    });
    const activeMatches = await prisma.match.findMany({
      where: { eventId: event.id, status: { in: ['scheduled', 'in_progress'] }, courtId: { not: null } },
      include: {
        team1: true,
        team2: true,
      },
    });
    const openCourts = event.courts.filter((court) => !activeMatches.some((match) => match.courtId === court.id));

    for (const court of openCourts) {
      await assignNextQueuedMatch(event.id, court.id, queuedMatches, activeMatches);
    }

    await completeEventIfFinished(event.id);

    const updated = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        courts: true,
        matches: {
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
            court: true,
          },
          orderBy: [{ round: 'asc' }, { bracketPosition: 'asc' }],
        },
        standings: {
          include: { team: { include: { player1: true, player2: true } } },
          orderBy: [{ wins: 'desc' }, { pointsFor: 'desc' }],
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to advance round' });
  }
});

roundRobinRouter.post('/:eventId/swap-players', async (req, res) => {
  try {
    const { matchId, team1PlayerIds, team2PlayerIds } = req.body;

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const team1 = await upsertTeam(team1PlayerIds);
    const team2 = await upsertTeam(team2PlayerIds);

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { team1Id: team1.id, team2Id: team2.id },
      include: {
        team1: { include: { player1: true, player2: true } },
        team2: { include: { player1: true, player2: true } },
        court: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to swap players' });
  }
});

async function upsertTeam(playerIds: string[]) {
  const normalized = playerIds.filter(Boolean);
  const existing = await prisma.team.findFirst({
    where: {
      player1Id: normalized[0],
      player2Id: normalized[1] || null,
    },
  });
  if (existing) return existing;

  return prisma.team.create({
    data: {
      player1Id: normalized[0],
      player2Id: normalized[1] || null,
    },
  });
}

async function createQueuedMatches(
  eventId: string,
  schedule: Array<{ round: number; courts: Array<{ team1: { player1Id: string; player2Id?: string }; team2: { player1Id: string; player2Id?: string } }> }>,
  courts: Array<{ id: string }>,
  format: string
) {
  const activeMatches: Array<{
    id: string;
    courtId: string | null;
    team1: { player1Id: string; player2Id: string | null } | null;
    team2: { player1Id: string; player2Id: string | null } | null;
  }> = [];
  const queuedMatches: Array<{
    id: string;
    courtId: string | null;
    team1: { player1Id: string; player2Id: string | null } | null;
    team2: { player1Id: string; player2Id: string | null } | null;
  }> = [];
  let queuePosition = 0;

  for (const roundData of schedule) {
    for (const courtAssignment of roundData.courts) {
      const match = await createQueuedMatch(eventId, roundData.round, queuePosition, courtAssignment, format);
      queuedMatches.push(match);
      queuePosition++;
    }
  }

  for (const court of courts) {
    await assignNextQueuedMatch(eventId, court.id, queuedMatches, activeMatches);
  }
}

async function createQueuedMatch(
  eventId: string,
  round: number,
  queuePosition: number,
  courtAssignment: { team1: { player1Id: string; player2Id?: string }; team2: { player1Id: string; player2Id?: string } },
  format: string
) {
    const team1 = await upsertTeam(
      format === 'doubles'
        ? [courtAssignment.team1.player1Id, courtAssignment.team1.player2Id || '']
        : [courtAssignment.team1.player1Id]
    );
    const team2 = await upsertTeam(
      format === 'doubles'
        ? [courtAssignment.team2.player1Id, courtAssignment.team2.player2Id || '']
        : [courtAssignment.team2.player1Id]
    );

    const match = await prisma.match.create({
      data: {
        eventId,
        team1Id: team1.id,
        team2Id: team2.id,
        round,
        status: 'scheduled',
        bracketPosition: queuePosition,
      },
      include: {
        team1: true,
        team2: true,
      },
    });

    // Initialize standings for teams
    for (const teamId of [team1.id, team2.id]) {
      await prisma.standing.upsert({
        where: { eventId_teamId: { eventId, teamId } },
        create: { eventId, teamId },
        update: {},
      });
    }

  return match;
}

async function assignNextQueuedMatch(
  eventId: string,
  courtId: string,
  queuedMatches: Array<{
    id: string;
    courtId: string | null;
    team1: { player1Id: string; player2Id: string | null } | null;
    team2: { player1Id: string; player2Id: string | null } | null;
  }>,
  activeMatches: Array<{
    id: string;
    courtId: string | null;
    team1: { player1Id: string; player2Id: string | null } | null;
    team2: { player1Id: string; player2Id: string | null } | null;
  }>
) {
  const activePlayerIds = new Set(activeMatches.flatMap(getMatchPlayerIds));
  const nextIndex = queuedMatches.findIndex((match) =>
    match.courtId === null && getMatchPlayerIds(match).every((playerId) => !activePlayerIds.has(playerId))
  );

  if (nextIndex === -1) return null;

  const [nextMatch] = queuedMatches.splice(nextIndex, 1);
  const assigned = await prisma.match.update({
    where: { id: nextMatch.id, eventId },
    data: { courtId },
    include: {
      team1: true,
      team2: true,
    },
  });
  activeMatches.push(assigned);
  return assigned;
}

function getMatchPlayerIds(match: {
  team1: { player1Id: string; player2Id: string | null } | null;
  team2: { player1Id: string; player2Id: string | null } | null;
}) {
  return [match.team1?.player1Id, match.team1?.player2Id, match.team2?.player1Id, match.team2?.player2Id].filter(
    Boolean
  ) as string[];
}

async function completeEventIfFinished(eventId: string) {
  const remaining = await prisma.match.count({
    where: { eventId, status: { not: 'completed' } },
  });

  if (remaining === 0) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'completed' },
    });
  }
}
