# DailyLoop

New puzzles every day. Play a few minutes. Beat your friends.

DailyLoop is a daily puzzle platform: every user gets the same puzzle for each game on a given
day, and can track streaks, compare scores, and climb a friends leaderboard. It's built as a
modular game platform — new games plug into a shared engine, scoring system, and daily-puzzle
scheduler without touching core code.

> **Status:** all 5 games, scoring/streaks/achievements, friends, and the admin panel are built
> and tested. See [docs/architecture.md](docs/architecture.md) for the full build log and the
> architectural decisions behind it, and [docs/deployment.md](docs/deployment.md) to ship it.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query
- **Backend:** Node.js, TypeScript, Fastify, Zod, Prisma
- **Database:** PostgreSQL
- **Auth:** server-side sessions (opaque cookie token, hashed in the DB), Argon2 password hashing
- **Testing:** Vitest, React Testing Library, Fastify integration tests

## Project structure

```
dailyloop/
├── apps/
│   ├── web/            React app (Vite)
│   └── api/             Fastify API
├── packages/
│   ├── shared/           Zod schemas, DTO types, date/timezone utils — used by both apps
│   ├── game-engine/       DailyGame interface, per-game modules, scoring, seeded RNG
│   └── config/            Shared tsconfig/eslint/prettier base config
├── prisma/                schema.prisma, migrations, seed.ts
├── docs/                  architecture & deployment notes
└── docker-compose.yml     local Postgres (+ a disposable Postgres for tests)
```

`packages/shared` and `packages/game-engine` ship as plain TypeScript source (no build step) —
both consumers (`tsx` for the API, Vite for the web app) transpile on the fly, so there's nothing
to rebuild when you change them.

## Prerequisites

- Node.js 20+ (developed against Node 26)
- Docker (for local Postgres) — or point `DATABASE_URL` at your own Postgres 14+ instance

## Getting started

```bash
npm install
cp .env.example .env        # already done if you're reading this from a fresh clone you set up
npm run db:up                 # starts Postgres (+ a separate disposable Postgres for tests)
npm run db:migrate             # creates the database schema
npm run db:seed                 # creates the admin + demo users below
npm run dev                      # starts the API on :4000 and the web app on :5173
```

Then open http://localhost:5173.

## Dev credentials

Created by `npm run db:seed`. **Fake, local-only credentials — never reuse these anywhere real.**

| Role  | Username | Email                  | Password       |
| ----- | -------- | ----------------------- | -------------- |
| Admin | `admin`  | `admin@dailyloop.dev`   | `DevAdmin123!` |
| Demo  | `harry`  | `harry@dailyloop.dev`   | `DemoPass123!` |
| Demo  | `sumit`  | `sumit@dailyloop.dev`   | `DemoPass123!` |
| Demo  | `aayush` | `aayush@dailyloop.dev`  | `DemoPass123!` |
| Demo  | `sagar`  | `sagar@dailyloop.dev`   | `DemoPass123!` |

The four demo users are already friends with each other so the friends leaderboard isn't empty
on first login. Before deploying anywhere real, change or remove the admin account.

## Environment variables

See [.env.example](.env.example) for the full list with comments. One `.env` file at the repo
root is shared by both apps (the API loads it explicitly; Vite is configured to read from the
repo root instead of `apps/web/`).

## Scripts

Run from the repo root:

| Command                 | What it does                                              |
| ------------------------ | ---------------------------------------------------------- |
| `npm run dev`              | Runs the API and web app together                          |
| `npm run build`             | Builds the web app for production                          |
| `npm run typecheck`          | Type-checks every package                                   |
| `npm run lint` / `format`     | ESLint / Prettier across the repo                           |
| `npm test`                     | Runs all test suites (needs the DB containers up + migrated) |
| `npm run db:up` / `db:down`      | Start/stop local Postgres (dev + test)                     |
| `npm run db:migrate`              | Create & apply a dev migration                              |
| `npm run db:studio`                | Open Prisma Studio                                          |
| `npm run db:seed`                   | (Re-)seed dev data                                          |

## Testing

Integration tests hit a **separate, disposable** Postgres container (`postgres_test`, started by
`npm run db:up`) so they never touch your dev data:

```bash
npm run db:up
npm run db:test:migrate   # once, or after a schema change
npm test
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for environment variables, build/start commands,
migration steps, and a pre-launch checklist.
