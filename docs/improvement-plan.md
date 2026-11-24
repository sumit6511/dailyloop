# Improvement plan — puzzle engines

Findings from a full read of `packages/game-engine` plus an empirical audit that generated 365
consecutive days of every game and measured the output (difficulty mix, solution uniqueness,
trivially-solvable targets, content repetition).

## Audit findings

| Game          | Finding                                                                                                                                                                        | Severity     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Connections   | "Shades of Red" contains AMBER and JADE (JADE is green, AMBER is orange/yellow) — a factually wrong answer key                                                                 | Bug          |
| Connections   | The bank has **no difficulty-4 (purple) category at all**; 30/365 days were four easy (1111) groups with no ramp                                                               | Bug          |
| Connections   | Categories are picked independently, so two categories sharing a word (RUBY: languages + gemstones, CLUB: sandwiches + card suits) can land in one grid → ambiguous/unsolvable | Bug (latent) |
| Connections   | After the first cycle the LRU order is fixed, so the exact same 4-category grid repeats every 12 days                                                                          | Issue        |
| Connections   | Only 48 categories; the "authored in fixed groups of 4 = one day" comment no longer matches how selection works                                                                | Issue        |
| Logic Puzzle  | Every puzzle has exactly 20 of 36 givens — no difficulty variation, and quite easy                                                                                             | Issue        |
| Logic Puzzle  | Hints are computed from the player's grid, which can contain _legal-but-wrong_ values → hints can be wrong, or "no hint" when the player is actually stuck on a mistake        | Bug          |
| Logic Puzzle  | No guarantee a puzzle is solvable by pure logic (it's only guaranteed unique)                                                                                                  | Issue        |
| Pathway       | ~49% of puzzles (180/365 unique, 185 with 2–9 solutions) have **multiple valid solutions**; Zip-style puzzles should have exactly one                                          | Issue        |
| Pathway       | Random-start DFS wastes its whole backtrack budget whenever it starts on the minority parity colour of an odd grid (can never succeed); paths are DFS-biased                   | Issue        |
| Pathway       | Fixed 5×5 / 5 checkpoints / 6 walls every day — no difficulty curve                                                                                                            | Issue        |
| Number Puzzle | 44/365 targets (12%) are reachable in **a single operation**; target is a uniformly random reachable value with no difficulty control                                          | Issue        |
| Number Puzzle | Redundant seed (`dateKey` + `daysSinceEpoch(dateKey)`); no worked solution is available to show a player who failed                                                            | Minor        |
| Word Guess    | Only 914 accepted guesses — very common words (SLATE, STARE, SNAKE, BRAKE, plurals like GAMES…) are rejected as "not a word"                                                   | Bug (UX)     |
| Guess It      | Only 31 entries → content repeats every month; no typo tolerance; repeating the same wrong guess burns a clue                                                                  | Issue        |
| API           | Speed bonus is measured from server `startedAt`, while the Logic Puzzle UI timer pauses when you leave the page — the two can disagree (design note, not changed here)         | Note         |
| API           | `submitMove` is read-modify-write without a version check; concurrent submits could drop a move (the Pathway UI already serialises moves, so low risk)                         | Note         |

## Plan (engine work, in order)

1. **Shared difficulty schedule** — `tierForDate(dateKey)`: Mon/Tue easy → Wed/Thu medium →
   Fri–Sun hard, so every procedural game ramps through the week like NYT/LinkedIn puzzles.
2. **Logic Puzzle** — a human-technique solver (naked/hidden singles → locked candidates → naked
   pairs) used to _grade_ puzzles; carve with 180° symmetry down to a tier-specific clue count,
   only accepting puzzles that are unique **and** solvable by the tier's techniques (never needs
   guessing). Fix hints: point out a wrong cell first, then deduce from the corrected grid.
3. **Pathway** — backbite-randomised Hamiltonian paths (parity-safe, far less DFS bias); after
   placing checkpoints, iteratively add walls that block alternative solutions until the puzzle is
   **unique**, then prune redundant walls. Size/checkpoints scale with the day's difficulty.
4. **Number Puzzle** — exhaustive solver that records, per reachable value, the fewest numbers
   needed and number of distinct solutions; pick targets that need ≥3 numbers (all 4 on hard days)
   with fewer solutions on harder days; store a worked solution revealed once the attempt ends.
5. **Connections** — fix the wrong answers, re-tier the bank so every grid is exactly one
   yellow/green/blue/purple category, reject word collisions, pick each tier independently so grids
   stop repeating, and substantially enlarge the bank (incl. real wordplay purple categories).
6. **Word Guess** — enlarge the accepted-guess dictionary.
7. **Guess It** — larger entry bank, typo-tolerant matching, ignore repeated guesses.

All content-shape changes are additive/optional so puzzles already stored in `DailyPuzzle.content`
keep validating and replaying exactly as before.

## Outcome

Measured with the same audit (365 consecutive generated days) after the changes:

| Game          | Before                                                   | After                                                                                                     |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Logic Puzzle  | 20 givens every day; hints could be wrong                | 16 / 14 / 10 givens (easy/medium/hard); 100% unique and solvable without guessing; hints flag wrong cells |
| Pathway       | 49% of puzzles had multiple solutions; always 5×5        | 100% unique (verified by the solver); 5×5 / 6×6 / 7×7 by tier; ≤60 ms to generate                         |
| Number Puzzle | 12% solvable in one operation                            | 0%; medium/hard always need all 4 numbers; hard has ≤2 distinct solutions; solution revealed              |
| Connections   | 48 categories, no purple tier, 1111 grids, 12-day repeat | 115 categories; always one per tier; exactly one valid grouping; 365 distinct grids per year              |
| Word Guess    | 914 accepted guesses                                     | ~12.6k accepted guesses (answers still curated)                                                           |
| Guess It      | 30 entries, exact matching only                          | 94 entries; typo-tolerant, accent/"the"-insensitive; repeat guesses are free                              |

Also fixed along the way: a Guess It clue that spelled out an accepted answer ("Air Jordan"), and
`.env.example`'s empty `CRON_SECRET` crashing API startup when the README setup steps were followed.

## Follow-ups (done in a second pass)

- **Hints were free.** Hints are now charged server-side: `GameAttempt.hintsUsed` counts each
  _distinct_ hint revealed (re-asking for the same one is free), feeds `ScoreMeta.hintsUsed`, and
  Logic Puzzle / Pathway deduct `SCORE.HINT_PENALTY` (10) per hint and withhold their flawless
  bonus. The Hint button shows the cost.
- **Speed bonus vs. paused timer.** Games can opt into `timing: "active"` (Logic Puzzle does):
  the server credits only gaps of at most `ACTIVE_TIME.MAX_GAP_MS` (45 s) between activity
  (moves, hints, heartbeats every 15 s while the puzzle is visible), and the page's timer shows
  that same server count. Time away is neither shown nor scored.
- **Concurrent writes.** Every attempt write is a compare-and-set on `GameAttempt.version` with
  retry, completion re-checks inside its transaction, and concurrent starts no longer crash. This
  fixed real bugs: concurrent moves were dropped, and two racing winning moves could reset the
  player's streak to 1.
- **Pathway hints.** "Next cell" or "back up to here", powered by the solver. Older puzzles that
  may have several solutions check whether the player's own route can still be finished before
  telling them to back up.

Remaining note: a pausable timer is inherently client-influenced — a player who deliberately
blocks heartbeats can avoid being timed for any gap over 45 s between moves. That is the trade-off
of letting the clock pause at all; moves and hints still count every shorter gap.

## Backlog — whole-app audit (round 3)

A second audit, this time of the API, web app, schema and tooling rather than just the engines.
Ordered by priority; each item is implemented and committed separately.

### Bugs

1. **Mixed-case email can't log in; usernames are case-sensitive.** Emails are stored lowercased
   but the login lookup isn't, so `Harry@x.com` fails. `Harry` and `harry` can both register
   (impersonation risk) and `/u/Harry` 404s for `harry`.
2. **Speed Demon unlocks on a loss** — e.g. submitting Number Puzzle immediately.
3. **Perfect Day miscounted** — it counts disabled games' puzzles (making it impossible) and only
   puzzles that happen to have been published lazily (so deep-linking early can award it after a
   single game).
4. **Midnight race** — when two requests generate today's puzzle at once, the loser gets "No puzzle
   is available today" instead of the puzzle the winner just created.
5. **500s on unique-constraint races** — concurrent registration with the same name, or an admin
   moving a puzzle onto an occupied date, return 500 instead of 409.
6. **Connections repeats cost mistakes** — re-submitting the same wrong four words costs another
   life; there's also no "one away…" feedback.
7. **Puzzle numbers can collide** — `count + 1` reuses a number after a deletion and isn't ordered
   by date.
8. **Deleting a puzzle leaves stale scores** — its attempts cascade away but DailyScore, leaderboards
   and Perfect Day aren't recomputed.

### Security

9. **Rate limits can be bypassed** — `trustProxy: true` trusts any client-supplied
   `X-Forwarded-For`, so a brute-forcer can rotate fake IPs past the login/register limits.
10. **Login timing reveals which accounts exist** — the Argon2 check is skipped for unknown users.
11. **Live password-reset links are written to production logs.**
12. **Reset tokens outlive their purpose** — earlier links stay valid after a new one is requested
    or the password is changed. Cron secret uses a non-constant-time compare.
13. **`avatarUrl` accepts any string** (it isn't rendered anywhere yet).

### Performance & reliability

14. **Every authenticated request writes to `Session`** (sliding expiry) — throttle it.
15. **Expired sessions and reset tokens are never deleted.**
16. **N+1 queries** in user search (3 per result) and the admin user list; the admin puzzle list is
    unbounded and ships every puzzle's full content.
17. **One 550 kB JS bundle** — admin pages and each game should be lazy-loaded.

### Tooling & docs

18. **No CI** — nothing runs lint, typecheck, tests or the build on a push or PR.
19. **Docs are stale** — "5 games" (there are 6), `CRON_SECRET` missing from the deploy env table,
    hint/timing changes undocumented in the architecture doc.

### Features

20. **Countdown to the next puzzles** on the dashboard and result screens.
21. **Leaderboard shows your own rank** even outside the top 50; ties share a rank.
22. **Richer share text** — a Connections colour grid, plus result lines for every game.
23. **Personal stats** — per-game played / win rate / average score, Word Guess guess distribution.
24. **Installable app** — a web manifest so it can be added to a home screen.
25. **More achievements** — e.g. a flawless (no mistakes, no hints) solve.

**Status:** items 1–25 are all done, each in its own commit with tests; every bug fix's new
tests were confirmed to fail against the code before the fix. Results worth noting: the main JS
bundle went from 550 kB to 416 kB (Luxon removed — an Intl replacement matched it on 355,936
checks), and the new CI workflow passed its first run on GitHub. Not changed on purpose: puzzle
numbers are `max + 1` (unique) but not renumbered by date, and streaks aren't rewritten after an
admin edit.

Needs your input (not started): real password-reset email delivery needs a provider and API key;
a past-puzzle archive and Word Guess hard mode are larger product decisions.

## Backlog — round 4 (dependencies, operations, accessibility, code health)

### Dependencies & security

1. **Seven high-severity advisories in production dependencies.** Six (`fastify` ×2, `fast-uri`,
   and `deepmerge-ts`/`effect` under Prisma) have non-breaking fixes. `zod` has no fixed 3.x
   release, so it needs the 3 → 4 upgrade (with `@hookform/resolvers`). Until then, request bodies
   should be capped well below Fastify's 1 MiB default.
2. **No security headers** on the API or the static web app (clickjacking, MIME sniffing,
   referrer leakage).

### Operations

3. **The health check doesn't check the database**, so a host keeps routing traffic to an instance
   that can't reach Postgres.
4. **No graceful shutdown** — every deploy/restart cuts in-flight requests (including a final move
   mid-transaction).

### Web app robustness

5. **An expired session mid-game just shows errors** — the client keeps believing it's logged in
   until its cached `/auth/me` goes stale. Any 401 should send the player to login and back.
6. **One crashing page blanks the whole app** — the only error boundary wraps everything, so even
   navigating away doesn't recover without a reload.

### Accessibility & gameplay UX

7. **Pathway is unplayable without a pointer** — no keyboard controls at all.
8. **Backing up in Pathway means dragging back cell by cell** — tapping a cell on your trail
   should cut the path back to it.

### Code health

9. **Formatting has drifted** — 112 files fail the repo's own Prettier config, and nothing checks it.
10. **The web app has 16 tests** — none for Pathway, Number Puzzle, Logic Puzzle or Guess It.

**Status:** all 10 done. Findings along the way that weren't on the list:

- Malformed JSON and oversized bodies returned **500** instead of 400/413.
- npm had installed **four copies of zod**; and classic zod 4 alone would have added ~450 kB to
  the web bundle, so the browser-side schemas moved to `zod/mini` (bundle 416 kB → 397 kB).
- `NODE_ENV=development` in the shared `.env` (as `.env.example` shipped it) silently made
  production web builds bundle **React's development build** (657 kB). Removed from the example,
  and the build now refuses to run with it.
- Number Puzzle's Submit answer **forfeited the day on one stray tap**; it now asks first.
- Text fields without an `id`/`name` had **no accessible label**.
- `npm audit`, production and dev: 0 vulnerabilities (fastify, fast-uri, Prisma's transitive
  deps, zod 3 → 4, vitest 3 → 5, typescript-eslint, shell-quote).

## Backlog — round 5

### Security & correctness

1. **Seeding production creates a publicly known admin.** `docs/deployment.md` says to run
   `npm run db:seed` on the production database, and the seed always creates
   `admin@dailyloop.dev` / `DevAdmin123!` (printed in the README) with the ADMIN role, plus demo
   users with a shared password.
2. **Streaks never decay on screen.** The streak row only changes when a game is completed, so
   after a missed day the dashboard, public profile, share text and admin list all keep showing
   the old streak until the player next plays.
3. **Editing a puzzle that's been played rewrites history.** Attempts are replayed against the
   stored content, so changing a played puzzle's content silently changes everyone's progress and
   result.
4. **Profiles and achievements are readable without logging in**, unlike every other player
   endpoint (and the web app, where `/u/:username` is behind login) — easy to scrape.
5. **No per-account login throttle** — the per-IP limit doesn't stop credential stuffing spread
   across many IPs against one account.

### Performance

6. **The icon font is 5.4 MB and render-blocking** (`display=block`), for ~65 icons. A subset is
   119 kB.
7. **Friend search sends a request per keystroke.**

### Features

8. **No way to delete your account.**
9. **Yesterday's answers** — after the day rolls over, show each game's solution (as daily puzzle
   sites do), so a player who gave up or didn't finish can see how it worked.

**Status:** all 9 done, each with tests. The bug fixes' tests were checked to fail against the old
code.

- Deployments now create their admin from `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
  `SEED_DEMO_USERS=true` is the explicit opt-in for the demo accounts.
- Profiles and achievements now need a login, matching the web app.
- The per-account lockout (10 failures in 15 minutes) means someone who knows a username can lock
  its owner out for 15 minutes. A successful password reset clears it.
- The icon font went from 5.4 MB to about 125 kB. Icon names are now typed, which turned up five
  icons the old regex scan had missed.

Found along the way, not on the list:

- **Logging out kept the previous player's cached data** (friends, leaderboards, stats) in
  memory, so the next person signing in on the same tab could briefly see it. Logout, password
  change, account deletion and session expiry now all drop it.

## Backlog — round 6 (UI/UX: one consistent, modern look)

An audit of every screen (16 signed-in pages and 3 signed-out ones, at 1440 px and 390 px wide)
found the app works but looks assembled screen by screen: similar things are styled differently,
and some screens are plainly off.

### Foundations

1. **No real theme.** Headings use a rounded font (Lexend) and numbers use Inter, which isn't
   tabular. There's no accent colour, and surface styles were picked per screen (ten different
   `bg-white/[…]` opacities). The app needs one set of tokens: a display face, a monospaced face
   for numbers, an accent, surface levels, radii and glows.
2. **The background is three animated, 120 px-blurred blobs.** They are expensive to composite on
   phones and wash the whole app with a purple/brown haze. A still aurora with a fine grid is
   cheaper and reads as deliberate.
3. **Controls disagree.** Buttons have no fixed heights, so rows of mixed buttons don't line up.
   Small touch targets are 32–40 px. The Leaderboard has two different segmented controls, and
   the admin tabs are a third style.

### Layout

4. **The header doesn't line up with the page** (a 1024 px box over 976 px of content), and page
   widths vary at random (Settings 512, Friends 672, Profile 512, Admin 1024).
5. **Every page builds its own title**, at three different sizes. Card titles are just as
   inconsistent.
6. **Three different "stat" styles** for the same thing: the admin tiles, the admin "today" row,
   and the profile stats.
7. **Dashboard game cards in a row have different heights**, so their buttons don't line up.

### Games

8. **Each game's top-right status uses its own style** (bare dots, a timer and a cog, dots with
   text, or nothing).
9. **Connections tiles are 160 px squares on a desktop**, and on a phone the action row wraps
   Submit onto a line of its own.
10. **Word Guess keys are 40 px**, below the 44 px minimum touch target.
11. **Number Puzzle's operator buttons are smaller than its number tiles**, with tiny glyphs.
12. **The Logic Puzzle grid is washed-out grey** and its printed digits are low-contrast. Its
    number pad is 40 px.
13. **Pathway's bottom row is shorter than the others** (the board's rows aren't sized), and its
    amber walls clash with everything else.

### Admin and the rest

14. **The puzzle list renders every puzzle at once**: 216 rows, a 16,000 px page.
15. **Admin sections use different widths.**
16. **The 404 and error screens are bare text.**

**Status:** all 16 done, in four commits (foundation and page layouts, admin, games). Every screen
was re-checked at 1440 px and 390 px: no horizontal overflow and no console errors. The shared
pieces it introduced are `PageHeader`, `SectionHeader`, `Stat`, `SegmentedControl`,
`StatusPanel`, `IconButton`, `DifficultyMeter`, `Page`, `HudChip`/`DotMeter`, plus
`buttonClasses()`, `FIELD_CLASSES` and the table styles. New screens should be built from these
rather than from raw `bg-white/[…]` classes.

Found along the way:

- **Pathway's last row was shorter than the others** (item 13).
- Three places put a `<button>` inside a link (the game cards, the profile's Edit button, and the
  404 page's home button). These are now links styled as buttons.
- **Game tiles had no keyboard focus indicator.**
- The mobile menu's links stayed in the tab order while the menu was closed.

Not done: a light theme, and screenshot-based visual regression tests.
