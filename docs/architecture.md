# Architecture

## Build status

- ✅ Phase 1 — monorepo, tooling, database schema, auth (register/login/logout/me/password
  reset), base authenticated shell
- ✅ Phase 2 — daily puzzle framework: `Game`/`DailyPuzzle` plumbing, `/games`, `/games/today`
  (publish/unpublish + today-only visibility, per-user completion state), admin puzzle CRUD +
  generate, all 5 `Game` rows seeded (no game logic yet — that's Phase 3/4)
- ✅ Phase 3 — Connections and Word Guess fully playable end-to-end: real game-engine modules,
  incremental move submission (`POST /games/:slug/attempts/start|submit`), server-verified
  scoring, the streak/DailyScore/Perfect-Day completion transaction, curated content (48
  categories, 914-word dictionary), 30 days of published history + 5 scheduled future days
  seeded, and a real dashboard/game-shell/result-screen UI
- ✅ Phase 4 — Number Puzzle (Countdown-style, incremental combine + explicit submit), Logic
  Puzzle (6×6 mini Sudoku with a real backtracking generator + uniqueness solver), and Guess It
  (progressive 4-clue reveal) — all 5 games are now fully playable, with all 5 registered in both
  the backend and frontend registries
- ✅ Phase 5 — achievement catalog + evaluation (unlocked atomically inside the same transaction
  as scoring/streak, so numbers it reads are never stale), daily/weekly/all-time leaderboards
  (computed on read, per the architecture decision above), leaderboard + achievements UI on the
  dashboard and result screens. Also fixed a real gap this exposed: a `SCHEDULED` puzzle now
  self-heals to `PUBLISHED` the first time it's looked up on/after its date, since there's no
  cron job in this app to flip that status at midnight (see `services/puzzle-lookup.ts`)
- ✅ Phase 6 — friends: requests (with auto-accept on a mutual request and row-reuse on
  re-request so the `(senderId, receiverId)` unique constraint never blocks a second attempt),
  friends list, relationship-aware public profiles, a friends-scoped leaderboard (reuses the
  same daily/weekly/all-time aggregation with a friend-ID filter), user search, and a
  spoiler-free share card (Web Share API with a clipboard fallback)
- ✅ Phase 7 — admin panel UI on top of the Phase 2 admin API: an Overview (user/attempt counts,
  per-game stats, today's activity feed), Puzzles (filter, generate-from-module, manual
  JSON-content create/edit, publish/unpublish, delete), Games (enable/disable), and Users tab,
  gated by an `AdminRoute` guard checking `role === "ADMIN"`. Verified live: generate → schedule
  → publish a real future puzzle end-to-end through the UI.
- ✅ Phase 8 — polish: error handling added to every game page's move-submission path (not just
  Word Guess), a styled 404 page, `aria-pressed`/`role="group"` + descriptive labels added to the
  previously screen-reader-silent tile/keyboard grids, frontend RTL tests for the components the
  spec called out (tile-selection limit, on-screen keyboard state, ResultScreen), and a real
  deployment guide. Also fixed a genuine mobile bug this phase's own responsive check surfaced:
  the header's Friends/Profile/Admin links were `hidden sm:block` with no mobile alternative —
  replaced with a hamburger menu (see `AppShell.tsx`).

Dev note: Playwright (Chromium) is installed as a devDependency purely as an ad hoc verification
tool for this build — not part of the checked-in test suite (which stays Vitest/RTL/Fastify
`.inject()` per the spec). Also: this environment's `tsx --watch` occasionally misses a file
change and needs a manual dev-server restart to pick up new routes — if a route 404s unexpectedly
during development, restart before assuming it's a code bug.

## Monorepo layout

```
apps/web        React (Vite) frontend
apps/api        Fastify API
packages/shared      Zod schemas + DTO types + date/timezone utils (no server or DOM deps)
packages/game-engine  DailyGame interface, per-game modules, scoring, seeded RNG
packages/config       Shared tsconfig/eslint/prettier base config
prisma/               schema.prisma, migrations, seed.ts
```

**Layering rule:** `apps/web` never imports Prisma or anything server-only. `packages/shared`
holds hand-written DTOs, not raw Prisma model types — `apps/api` maps Prisma models to DTOs at
the API boundary (see `apps/api/src/lib/dto.ts`). This keeps the frontend's build independent of
the ORM and free to evolve the DB schema without breaking client types.

**No build step for internal packages.** `packages/shared` and `packages/game-engine` are
consumed as raw TypeScript source — `package.json#main` points straight at `src/index.ts`. Both
real consumers (`tsx`, which runs the API in dev _and_ production, and Vite/esbuild for the web
app) transpile TypeScript on the fly, so there's no `dist/` to go stale or forget to rebuild.

## Authentication

Server-side sessions, not JWT: `POST /auth/login` creates a `Session` row and returns an opaque
random token in an httpOnly, `SameSite=Lax` cookie. Only the **SHA-256 hash** of that token is
stored — a DB leak doesn't hand out usable session tokens. Logout deletes the row, so revocation
is immediate and real (no waiting for a JWT to expire). Sessions slide forward on each request up
to `SESSION_DURATION_DAYS`.

CSRF defense is the SameSite cookie plus an Origin-header allow-list check on any
POST/PUT/PATCH/DELETE (`apps/api/src/plugins/csrf.ts`) — no double-submit token needed for a
single first-party frontend origin.

## Daily puzzles & timezone

`getTodayKey()` in `packages/shared/src/date.ts` is the **only** place "today" is computed —
always from the server clock via Luxon against a configurable IANA timezone (default
`Asia/Kathmandu`), never from anything a client sends. `DailyPuzzle` rows are looked up by
`(gameId, date)` and only ever served to clients when `status = PUBLISHED`, so a guessed ID for a
future/scheduled puzzle 404s.

Calendar dates are stored as UTC-midnight `@db.Date` values regardless of the rollover timezone —
see the comment on `dateKeyToJSDate`/`jsDateToDateKey` for why mixing those two concerns causes
off-by-one-day bugs.

## Game engine

Each game is a module implementing one interface (`packages/game-engine/src/types.ts`):

```ts
interface DailyGameModule<TContent, TMove, TResult> {
  id: string;
  generatePuzzle(seed: string, dateKey: string): TContent;
  // moves is the FULL history so far — replayed from scratch every call, never trusted incrementally.
  validateAttempt(content: TContent, moves: TMove[]): ValidationResult<TResult>;
  calculateScore(content: TContent, result: TResult, meta: ScoreMeta): ScoreBreakdown;
  sanitizeForClient(content: TContent, attempt: AttemptState<TMove> | null): unknown;
}
```

Games like Connections and Word Guess are inherently incremental (one guess at a time, with
feedback each time) — `POST /games/:slug/moves` appends one new move to the attempt's stored
history and re-validates the whole history, so the server's idea of "solved groups so far" or
"guesses used" can never desync from what the client shows.

A registry (`packages/game-engine/src/registry.ts`) maps slug → module. The DB `Game` table
controls which games are enabled and how they're displayed; the registry controls behavior.
**Adding a game means one new file + one registry line + one seeded DB row** — no changes to
routing, scoring, streaks, or the dashboard.

Puzzle content (including answers) lives server-side only, in `DailyPuzzle.content`.
`sanitizeForClient` strips answers before a puzzle is sent to the browser, and the real
`validateAttempt`/`calculateScore` always run on the server against that stored content — the
client only ever sends its raw moves.

## Scoring, streaks, perfect day

Every game normalizes its own score to 0–100. A day's total is the sum of that day's completed
games plus a flat Perfect Day bonus — so no single game can dominate the leaderboard just because
it naturally produces bigger numbers.

Finishing an attempt runs one Prisma transaction that: rejects a re-submit of an already-completed
attempt (backed by a `@@unique([userId, dailyPuzzleId])` constraint as a hard stop against
race conditions), records the server-computed score, upserts that day's `DailyScore`
(recomputing `isPerfectDay` against however many games were actually published that day, so
disabling a game doesn't retroactively break Perfect Day), and updates the `Streak` row
(consecutive day → +1, same day again → no-op, any gap → reset to 1).

## Why some spec entities were merged or dropped

- **`GamePuzzle` + `DailyPuzzle` → one `DailyPuzzle` table.** A puzzle's content is 1:1 with its
  (game, date); there's no reuse case that justifies a separate template table.
- **No physical `Leaderboard` table.** Daily/weekly/all-time/friends leaderboards are computed on
  read from `DailyScore` (+ `Friendship`) rather than a denormalized table that could drift out of
  sync with the scores it's supposed to summarize.
