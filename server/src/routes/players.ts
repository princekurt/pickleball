import { Router } from 'express';
import prisma from '../lib/prisma.js';

export const playersRouter = Router();

playersRouter.get('/', async (req, res) => {
  try {
    const { search, skillLevel } = req.query;
    const where: Record<string, unknown> = {};

    if (search && typeof search === 'string') {
      where.name = { contains: search };
    }
    if (skillLevel && typeof skillLevel === 'string') {
      where.skillLevel = parseFloat(skillLevel);
    }

    const players = await prisma.player.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const stats = await Promise.all(
      players.map(async (player) => {
        const teams = await prisma.team.findMany({
          where: {
            OR: [{ player1Id: player.id }, { player2Id: player.id }],
          },
        });
        const teamIds = teams.map((t) => t.id);

        const matches = await prisma.match.findMany({
          where: {
            status: 'completed',
            OR: [{ team1Id: { in: teamIds } }, { team2Id: { in: teamIds } }],
          },
        });

        let wins = 0;
        let losses = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;

        for (const match of matches) {
          const isTeam1 = teamIds.includes(match.team1Id || '');
          const myScore = isTeam1 ? match.team1Score : match.team2Score;
          const oppScore = isTeam1 ? match.team2Score : match.team1Score;
          pointsFor += myScore;
          pointsAgainst += oppScore;
          if (myScore > oppScore) wins++;
          else if (oppScore > myScore) losses++;
        }

        return {
          ...player,
          stats: {
            gamesPlayed: matches.length,
            wins,
            losses,
            winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
            pointsFor,
            pointsAgainst,
          },
        };
      })
    );

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

playersRouter.get('/:id', async (req, res) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

playersRouter.post('/', async (req, res) => {
  try {
    const { name, skillLevel, email, phone, avatarUrl } = req.body;
    const player = await prisma.player.create({
      data: {
        name,
        skillLevel: skillLevel ?? 3.0,
        email: email || null,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
      },
    });
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create player' });
  }
});

playersRouter.put('/:id', async (req, res) => {
  try {
    const { name, skillLevel, email, phone, avatarUrl } = req.body;
    const player = await prisma.player.update({
      where: { id: req.params.id },
      data: { name, skillLevel, email, phone, avatarUrl },
    });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update player' });
  }
});

playersRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete player' });
  }
});
