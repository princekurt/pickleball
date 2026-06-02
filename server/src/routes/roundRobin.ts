import { Router } from 'express';
import prisma from '../lib/prisma.js';
import {
  generateDoublesRoundRobin,
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
    } = req.body;

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
        ? generateDoublesRoundRobin(players, numCourts, skillBalanced)
        : generateSinglesRoundRobin(players, numCourts);

    // Create teams and first round matches
    await createRoundMatches(event.id, schedule[0], courts, format);

    await prisma.event.update({
      where: { id: event.id },
      data: {
        status: 'in_progress',
        config: JSON.stringify({ ...config, currentRound: 1, schedule: schedule.length }),
      },
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        eventPlayers: { include: { player: true } },
        courts: true,
        matches: {
          where: { round: 1 },
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
            court: true,
          },
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

    const incomplete = event.matches.filter((m) => m.status !== 'completed');
    if (incomplete.length > 0) {
      return res.status(400).json({ error: 'Complete all current matches first' });
    }

    const config = JSON.parse(event.config || '{}');
    const currentRound = config.currentRound || 1;
    const nextRound = currentRound + 1;

    const players = event.eventPlayers.map((ep) => ep.player);
    const schedule =
      event.format === 'doubles'
        ? generateDoublesRoundRobin(players, event.courts.length, config.skillBalanced, config.sitOutCounts || {})
        : generateSinglesRoundRobin(players, event.courts.length, config.sitOutCounts || {});

    if (nextRound > schedule.length) {
      await prisma.event.update({
        where: { id: event.id },
        data: { status: 'completed' },
      });
      return res.json({ message: 'Round robin complete', status: 'completed' });
    }

    const roundData = schedule[nextRound - 1];
    await createRoundMatches(event.id, roundData, event.courts, event.format);

    await prisma.event.update({
      where: { id: event.id },
      data: {
        config: JSON.stringify({ ...config, currentRound: nextRound }),
      },
    });

    const updated = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        courts: true,
        matches: {
          where: { round: nextRound },
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
            court: true,
          },
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
  const existing = await prisma.team.findFirst({
    where: {
      player1Id: playerIds[0],
      player2Id: playerIds[1] || null,
    },
  });
  if (existing) return existing;

  return prisma.team.create({
    data: {
      player1Id: playerIds[0],
      player2Id: playerIds[1] || null,
    },
  });
}

async function createRoundMatches(
  eventId: string,
  roundData: { round: number; courts: Array<{ courtIndex: number; team1: { player1Id: string; player2Id?: string }; team2: { player1Id: string; player2Id?: string } }>; sittingOut: string[] },
  courts: Array<{ id: string }>,
  format: string
) {
  for (const courtAssignment of roundData.courts) {
    const team1 = await upsertTeam(
      format === 'doubles'
        ? [courtAssignment.team1.player1Id, courtAssignment.team1.player2Id!]
        : [courtAssignment.team1.player1Id]
    );
    const team2 = await upsertTeam(
      format === 'doubles'
        ? [courtAssignment.team2.player1Id, courtAssignment.team2.player2Id!]
        : [courtAssignment.team2.player1Id]
    );

    await prisma.match.create({
      data: {
        eventId,
        courtId: courts[courtAssignment.courtIndex]?.id,
        team1Id: team1.id,
        team2Id: team2.id,
        round: roundData.round,
        status: 'scheduled',
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
  }
}
