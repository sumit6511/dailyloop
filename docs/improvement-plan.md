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
