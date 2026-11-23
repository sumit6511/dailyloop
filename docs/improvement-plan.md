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

1. **Shared difficulty schedule** — `difficultyForDate(dateKey)`: Mon/Tue easy → Wed/Thu medium →
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
