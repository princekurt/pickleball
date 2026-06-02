import { Router } from 'express';
import prisma from '../lib/prisma.js';

export const eventsRouter = Router();

eventsRouter.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const where = type ? { type: type as string } : {};
    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { matches: true, eventPlayers: true } },
      },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

eventsRouter.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
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
          include: {
            team: { include: { player1: true, player2: true } },
          },
          orderBy: [{ wins: 'desc' }, { pointsFor: 'desc' }],
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

eventsRouter.post('/', async (req, res) => {
  try {
    const { name, date, location, type, format, config } = req.body;
    const event = await prisma.event.create({
      data: {
        name,
        date: date ? new Date(date) : new Date(),
        location,
        type,
        format,
        config: config ? JSON.stringify(config) : null,
      },
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

eventsRouter.put('/:id', async (req, res) => {
  try {
    const { name, date, location, status, config } = req.body;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        name,
        date: date ? new Date(date) : undefined,
        location,
        status,
        config: config ? JSON.stringify(config) : undefined,
      },
    });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

eventsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

eventsRouter.get('/:id/history', async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: { eventId: req.params.id, status: 'completed' },
      include: {
        team1: { include: { player1: true, player2: true } },
        team2: { include: { player1: true, player2: true } },
        court: true,
      },
      orderBy: { completedAt: 'desc' },
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

eventsRouter.get('/:id/export/csv', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        standings: {
          include: { team: { include: { player1: true, player2: true } } },
          orderBy: [{ wins: 'desc' }, { pointsFor: 'desc' }],
        },
        matches: {
          where: { status: 'completed' },
          include: {
            team1: { include: { player1: true, player2: true } },
            team2: { include: { player1: true, player2: true } },
          },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const lines: string[] = [];
    lines.push('Standings');
    lines.push('Rank,Name,Wins,Losses,Points For,Points Against,Point Diff');
    event.standings.forEach((s, i) => {
      const name = s.team.player2
        ? `${s.team.player1.name} & ${s.team.player2.name}`
        : s.team.player1.name;
      lines.push(`${i + 1},${name},${s.wins},${s.losses},${s.pointsFor},${s.pointsAgainst},${s.pointsFor - s.pointsAgainst}`);
    });
    lines.push('');
    lines.push('Match History');
    lines.push('Round,Team 1,Team 2,Score 1,Score 2,Completed');
    event.matches.forEach((m) => {
      const t1 = m.team1?.player2 ? `${m.team1.player1.name} & ${m.team1.player2.name}` : m.team1?.player1.name || 'TBD';
      const t2 = m.team2?.player2 ? `${m.team2.player1.name} & ${m.team2.player2.name}` : m.team2?.player1.name || 'TBD';
      lines.push(`${m.round},${t1},${t2},${m.team1Score},${m.team2Score},${m.completedAt?.toISOString() || ''}`);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name}-export.csv"`);
    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to export' });
  }
});
