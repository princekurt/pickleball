import express from 'express';
import cors from 'cors';
import { playersRouter } from './routes/players.js';
import { eventsRouter } from './routes/events.js';
import { courtsRouter } from './routes/courts.js';
import { matchesRouter } from './routes/matches.js';
import { roundRobinRouter } from './routes/roundRobin.js';
import { tournamentRouter } from './routes/tournament.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/players', playersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/courts', courtsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/round-robin', roundRobinRouter);
app.use('/api/tournament', tournamentRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
