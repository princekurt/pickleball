import { Router } from 'express';
import prisma from '../lib/prisma.js';

export const matchesRouter = Router();

matchesRouter.get('/:id', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        team1: { include: { player1: true, player2: true } },
        team2: { include: { player1: true, player2: true } },
        court: true,
        event: true,
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

matchesRouter.put('/:id', async (req, res) => {
  try {
    const { team1Score, team2Score, status, courtId, scheduledTime, bracketPosition } = req.body;
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        team1Score,
        team2Score,
        status,
        courtId,
        bracketPosition,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      },
      include: {
        team1: { include: { player1: true, player2: true } },
        team2: { include: { player1: true, player2: true } },
        court: true,
      },
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update match' });
  }
});

matchesRouter.post('/:id/score', async (req, res) => {
  try {
    const { team1Score, team2Score, confirm } = req.body;
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const updated = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        team1Score,
        team2Score,
        status: confirm ? 'completed' : 'in_progress',
        completedAt: confirm ? new Date() : null,
      },
      include: {
        team1: { include: { player1: true, player2: true } },
        team2: { include: { player1: true, player2: true } },
        court: true,
      },
    });

    if (confirm && match.status !== 'completed' && match.event.type === 'round_robin') {
      await updateRoundRobinStandings(match.eventId, updated);
      await fillOpenRoundRobinCourts(match.eventId);
      await completeRoundRobinIfFinished(match.eventId);
    }

    if (confirm && match.status !== 'completed' && match.event.type === 'tournament') {
      await advanceTournamentWinner(updated);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

async function fillOpenRoundRobinCourts(eventId: string) {
  const courts = await prisma.court.findMany({
    where: { eventId },
    orderBy: { name: 'asc' },
  });

  for (const court of courts) {
    const activeMatch = await prisma.match.findFirst({
      where: { eventId, courtId: court.id, status: 'in_progress' },
    });
    if (activeMatch) continue;

    const nextMatch = await prisma.match.findFirst({
      where: { eventId, courtId: court.id, status: 'scheduled' },
      orderBy: [{ round: 'asc' }, { bracketPosition: 'asc' }],
    });

    if (nextMatch) {
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: { status: 'in_progress' },
      });
    }
  }
}

async function completeRoundRobinIfFinished(eventId: string) {
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

async function updateRoundRobinStandings(
  eventId: string,
  match: { team1Id: string | null; team2Id: string | null; team1Score: number; team2Score: number }
) {
  if (!match.team1Id || !match.team2Id) return;

  const team1Won = match.team1Score > match.team2Score;
  const team2Won = match.team2Score > match.team1Score;

  for (const [teamId, won, pf, pa] of [
    [match.team1Id, team1Won, match.team1Score, match.team2Score],
    [match.team2Id, team2Won, match.team2Score, match.team1Score],
  ] as [string, boolean, number, number][]) {
    await prisma.standing.upsert({
      where: { eventId_teamId: { eventId, teamId } },
      create: {
        eventId,
        teamId,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        pointsFor: pf,
        pointsAgainst: pa,
      },
      update: {
        wins: { increment: won ? 1 : 0 },
        losses: { increment: won ? 0 : 1 },
        pointsFor: { increment: pf },
        pointsAgainst: { increment: pa },
      },
    });
  }
}

async function advanceTournamentWinner(match: {
  id: string;
  eventId: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number;
  team2Score: number;
  bracket: string | null;
  bracketPosition: number | null;
  round: number;
}) {
  const winnerId = match.team1Score > match.team2Score ? match.team1Id : match.team2Id;
  const loserId = match.team1Score > match.team2Score ? match.team2Id : match.team1Id;
  if (!winnerId) return;

  const nextPosition = Math.floor((match.bracketPosition || 0) / 2);
  const nextRound = match.round + 1;

  const nextMatch = await prisma.match.findFirst({
    where: {
      eventId: match.eventId,
      bracket: match.bracket,
      round: nextRound,
      bracketPosition: nextPosition,
    },
  });

  if (nextMatch) {
    const isFirstSlot = (match.bracketPosition || 0) % 2 === 0;
    await prisma.match.update({
      where: { id: nextMatch.id },
      data: isFirstSlot ? { team1Id: winnerId } : { team2Id: winnerId },
    });
  }

  if (match.bracket === 'winners' && loserId) {
    const losersMatch = await prisma.match.findFirst({
      where: {
        eventId: match.eventId,
        bracket: 'losers',
        round: match.round,
      },
      orderBy: { bracketPosition: 'asc' },
    });
    if (losersMatch && !losersMatch.team2Id) {
      await prisma.match.update({
        where: { id: losersMatch.id },
        data: { team2Id: loserId },
      });
    }
  }
}
