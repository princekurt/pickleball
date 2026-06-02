import express from 'express';
import cors from 'cors';
import { playersRouter } from './routes/players.js';
import { eventsRouter } from './routes/events.js';
import { courtsRouter } from './routes/courts.js';
import { matchesRouter } from './routes/matches.js';
import { roundRobinRouter } from './routes/roundRobin.js';
import { tournamentRouter } from './routes/tournament.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_ORIGIN?.split(',').map((o) => o.trim()) ?? []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, allowedOrigins.length === 0);
      }
    },
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ name: 'Pickleball Manager API', status: 'ok' });
});

app.use('/api/players', playersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/courts', courtsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/round-robin', roundRobinRouter);
app.use('/api/tournament', tournamentRouter);

export default app;
