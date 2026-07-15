# LeetCode Re-Solve Tracker

A mobile-first web app that schedules spaced re-solves of LeetCode problems using a fixed 4-stage spaced repetition system.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL and SESSION_SECRET
```

### 3. Create the database schema

```bash
cd server
npx prisma migrate deploy
```

### 4. Run in development

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

## Adding problems

Problems are entered manually in the app — click **Add Problem** and enter the
LeetCode problem number, title, and difficulty (tags optional). No pre-seeded
catalog is required. The optional `npm run seed --workspace=server` script
still exists if you ever want to bulk-import popular problems.

## Running tests

```bash
npm test
```

Tests cover the domain scheduling module exhaustively (schedule.test.ts).

## Project structure

```
├── client/                # Vite + React frontend
│   └── src/
│       ├── components/    # Shared UI components
│       ├── contexts/      # AuthContext
│       ├── lib/           # API client, utils
│       └── pages/         # Route pages
├── server/                # Express backend
│   ├── prisma/            # Schema + migrations
│   └── src/
│       ├── domain/        # Pure scheduling logic + tests
│       ├── middleware/     # Auth guard
│       └── routes/        # API routes
├── scripts/               # Seed script
└── data/
    └── problems.json      # Fallback problem catalog (~100 popular problems)
```

## Domain rules (summary)

| Stage | Due after pass |
|-------|----------------|
| 1     | +3 days from initial solve |
| 2     | +10 days from S1 pass |
| 3     | +30 days from S2 pass |
| 4     | +90 days from S3 pass |

FAIL at any stage → reset to Stage 0, due in 3 days. History preserved.
PASS Stage 4 → MASTERED, removed from scheduling.
