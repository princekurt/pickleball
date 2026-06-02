import { Router } from 'express';
import prisma from '../lib/prisma.js';

export const courtsRouter = Router();

courtsRouter.get('/', async (_req, res) => {
  try {
    const courts = await prisma.court.findMany({ orderBy: { name: 'asc' } });
    res.json(courts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courts' });
  }
});

courtsRouter.post('/', async (req, res) => {
  try {
    const { name, eventId, isActive } = req.body;
    const court = await prisma.court.create({
      data: { name, eventId: eventId || null, isActive: isActive ?? true },
    });
    res.status(201).json(court);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create court' });
  }
});

courtsRouter.put('/:id', async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const court = await prisma.court.update({
      where: { id: req.params.id },
      data: { name, isActive },
    });
    res.json(court);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update court' });
  }
});

courtsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.court.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete court' });
  }
});
