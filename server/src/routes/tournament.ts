import { Router } from 'express';
import prisma from '../lib/prisma.js';
import {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  getBracketSize,
  assignTeamsToFirstRound,
  getByeCount,
} from '../lib/scheduling/tournament.js';

export const tournamentRouter = Router();

tournamentRouter.post('/setup', async (req, res) => {
  try {
    const {
      name,
      date,
      location,
      playerIds,
      format,
      tournamentFormat,
      seedingMethod,
      bestOf,
      partnerPairs,
    } = req.body;

    const manualTeams =
      format === 'doubles' && Array.isArray(partnerPairs)
        ? partnerPairs.map(([player1Id, player2Id]: [string, string]) => ({ player1Id, player2Id }))
        : undefined;

    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      orderBy: seedingMethod === 'skill' ? { skillLevel: 'desc' } : { name: 'asc' },
    });

    if (players.length < 2) {
      return res.status(400).json({ error: 'Minimum 2 players required' });
    }

    const event = await prisma.event.create({
      data: {
        name,
        date: date ? new Date(date) : new Date(),
        location,
        type: 'tournament',
        format,
        status: 'setup',
        config: JSON.stringify({
          tournamentFormat,
          seedingMethod,
          bestOf: bestOf || 1,
        }),
      },
    });

    // Create teams
    const teams: Array<{ id: string; seed: number }> = [];
    if (format === 'doubles' && manualTeams) {
      for (let i = 0; i < manualTeams.length; i++) {
        const pair = manualTeams[i];
        const team = await prisma.team.create({
          data: {
            player1Id: pair.player1Id,
            player2Id: pair.player2Id,
          },
        });
        teams.push({ id: team.id, seed: i + 1 });
        await prisma.eventPlayer.createMany({
          data: [
            { eventId: event.id, playerId: pair.player1Id, seed: i + 1 },
            { eventId: event.id, playerId: pair.player2Id, seed: i + 1 },
          ],
        });
      }
    } else if (format === 'doubles') {
      for (let i = 0; i < players.length - 1; i += 2) {
        const team = await prisma.team.create({
          data: {
            player1Id: players[i].id,
            player2Id: players[i + 1]?.id,
          },
        });
        teams.push({ id: team.id, seed: Math.floor(i / 2) + 1 });
        await prisma.eventPlayer.createMany({
          data: [
            { eventId: event.id, playerId: players[i].id, seed: Math.floor(i / 2) + 1 },
            ...(players[i + 1] ? [{ eventId: event.id, playerId: players[i + 1].id, seed: Math.floor(i / 2) + 1 }] : []),
          ],
        });
      }
    } else {
      for (let i = 0; i < players.length; i++) {
        const team = await prisma.team.create({
          data: { player1Id: players[i].id },
        });
        teams.push({ id: team.id, seed: i + 1 });
        await prisma.eventPlayer.create({
          data: { eventId: event.id, playerId: players[i].id, seed: i + 1 },
        });
      }
    }

    const numTeams = teams.length;
    const bracketSize = getBracketSize(numTeams);
    const byeCount = getByeCount(numTeams);

    let bracketMatches;
    if (tournamentFormat === 'double_elimination') {
      bracketMatches = generateDoubleEliminationBracket(numTeams);
    } else {
      bracketMatches = generateSingleEliminationBracket(numTeams);
    }

    const teamAssignment = assignTeamsToFirstRound(teams, bracketSize);
    const firstRoundMatches = bracketMatches.filter((m) => m.round === 1);

    for (let i = 0; i < firstRoundMatches.length; i++) {
      const bm = firstRoundMatches[i];
      const team1Id = teamAssignment.get(i * 2) || null;
      const team2Id = teamAssignment.get(i * 2 + 1) || null;

      // Handle byes
      const isBye = !team1Id || !team2Id;
      await prisma.match.create({
        data: {
          eventId: event.id,
          team1Id,
          team2Id,
          round: bm.round,
          bracket: bm.bracket,
          bracketPosition: bm.bracketPosition,
          status: isBye ? 'completed' : 'scheduled',
          bestOf: bestOf || 1,
          team1Score: isBye && team1Id ? 1 : 0,
          team2Score: isBye && team2Id ? 1 : 0,
        },
      });
    }

    // Create remaining bracket matches (empty)
    const otherMatches = bracketMatches.filter((m) => m.round > 1);
    for (const bm of otherMatches) {
      await prisma.match.create({
        data: {
          eventId: event.id,
          round: bm.round,
          bracket: bm.bracket,
          bracketPosition: bm.bracketPosition,
          status: 'scheduled',
          bestOf: bestOf || 1,
        },
      });
    }

    // Auto-advance bye winners
    const byeMatches = await prisma.match.findMany({
      where: { eventId: event.id, round: 1, status: 'completed' },
    });
    for (const byeMatch of byeMatches) {
      const winnerId = byeMatch.team1Id || byeMatch.team2Id;
      if (!winnerId) continue;

      const nextMatch = await prisma.match.findFirst({
        where: {
          eventId: event.id,
          bracket: byeMatch.bracket,
          round: 2,
          bracketPosition: Math.floor((byeMatch.bracketPosition || 0) / 2),
        },
      });
      if (nextMatch) {
        const isFirstSlot = (byeMatch.bracketPosition || 0) % 2 === 0;
        await prisma.match.update({
          where: { id: nextMatch.id },
          data: isFirstSlot ? { team1Id: winnerId } : { team2Id: winnerId },
        });
      }
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'in_progress' },
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        eventPlayers: { include: { player: true } },
        matches: {
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
          },
          orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { bracketPosition: 'asc' }],
        },
      },
    });

    res.status(201).json(fullEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to setup tournament' });
  }
});

tournamentRouter.get('/:eventId/bracket', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: {
        matches: {
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
          },
          orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { bracketPosition: 'asc' }],
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const config = JSON.parse(event.config || '{}');
    const winnersBracket = event.matches.filter((m) => m.bracket === 'winners' || !m.bracket);
    const losersBracket = event.matches.filter((m) => m.bracket === 'losers');

    res.json({
      event,
      winnersBracket,
      losersBracket,
      tournamentFormat: config.tournamentFormat,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bracket' });
  }
});
