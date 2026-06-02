# Pickleball Tournament Manager

A full-stack web app for managing pickleball events — supporting both casual Round Robin sessions and structured Tournaments. Built for courtside use on tablets and mobile devices.

## Features

- **Player Management** — Add, edit, delete players with skill levels (2.0–5.0), contact info, and stats dashboard
- **Round Robin Mode** — Auto-generated schedules, skill-balanced teams, court rotation, live scoring, and standings
- **Tournament Mode** — Single/double elimination brackets with visual bracket view, seeding, and score entry
- **Shared** — Court management, game history, CSV export, dark mode, responsive design, localStorage persistence

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, React Router v7
- **Backend:** Node.js, Express 5, Prisma, SQLite
- **Database:** SQLite (local) — easily switchable to PostgreSQL for deployment

## Quick Start

```bash
# Install dependencies
npm install

# Set up database (generate, migrate, seed with 12 sample players)
npm run db:setup

# Start dev servers (API on :3001, UI on :5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
pickleball/
├── client/                 # React frontend
│   └── src/
│       ├── components/
│       │   ├── players/    # Player CRUD components
│       │   ├── round-robin/# Round robin setup & dashboard
│       │   ├── tournament/ # Tournament setup & bracket view
│       │   ├── shared/     # Layout, Avatar, StatusBadge
│       │   └── ui/         # shadcn/ui components
│       ├── pages/          # Route pages
│       ├── store/          # Zustand stores
│       ├── hooks/          # Custom hooks
│       ├── lib/            # API client, utils
│       └── types/          # TypeScript types
├── server/                 # Express API
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   └── lib/
│   │       └── scheduling/ # Round robin & bracket algorithms
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.ts         # Sample data (12 players)
└── package.json            # Workspace root
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/players` | List players with stats |
| POST | `/api/players` | Create player |
| POST | `/api/round-robin/setup` | Start round robin session |
| POST | `/api/round-robin/:id/next-round` | Advance to next round |
| POST | `/api/tournament/setup` | Create tournament |
| GET | `/api/tournament/:id/bracket` | Get bracket data |
| POST | `/api/matches/:id/score` | Submit match score |
| GET | `/api/events/:id/export/csv` | Export standings & history |

## Sample Data

The seed script creates 12 players with varied skill levels (2.0–5.0) and 4 default courts, ready for immediate testing.

## Deployment

To use PostgreSQL instead of SQLite, update `server/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then set `DATABASE_URL` in your environment and run migrations.
