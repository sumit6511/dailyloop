import { shuffle } from "../../rng.js";
import type { PuzzleTier } from "../../difficulty.js";

export const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const CELL_COUNT = SIZE * SIZE;
const VALUES = [1, 2, 3, 4, 5, 6];

export type Grid = number[][];

/**
 * Human solving techniques, in increasing order of difficulty. A puzzle's grade is the hardest
 * technique a human-style solver *needs* to finish it (it always tries easier ones first).
 */
export type Technique =
  "naked-single" | "hidden-single" | "locked-candidates" | "naked-pair" | "hidden-pair";

const TECHNIQUE_LEVEL: Record<Technique, number> = {
  "naked-single": 1,
  "hidden-single": 1,
  "locked-candidates": 2,
  "naked-pair": 3,
  "hidden-pair": 3,
};

export interface HintCell {
  row: number;
  col: number;
  /** The value to place — or 0 when `kind` is "fix", meaning "clear this cell". */
  value: number;
  /** "place": a deducible next move. "fix": an already-filled cell that is wrong. Optional so
   * older callers that only read row/col/value keep working. */
  kind?: "place" | "fix";
  /** How the placement can be deduced (absent for "fix" and for the solution fallback). */
  technique?: Technique;
}

// --- Unit/peer tables (computed once) ---------------------------------------------------------

const ROW_OF = Array.from({ length: CELL_COUNT }, (_, i) => Math.floor(i / SIZE));
const COL_OF = Array.from({ length: CELL_COUNT }, (_, i) => i % SIZE);
const BOX_OF = Array.from(
  { length: CELL_COUNT },
  (_, i) =>
    Math.floor(ROW_OF[i]! / BOX_ROWS) * (SIZE / BOX_COLS) + Math.floor(COL_OF[i]! / BOX_COLS),
);

const ROW_UNITS: number[][] = Array.from({ length: SIZE }, (_, r) =>
  Array.from({ length: SIZE }, (_, c) => r * SIZE + c),
);
const COL_UNITS: number[][] = Array.from({ length: SIZE }, (_, c) =>
  Array.from({ length: SIZE }, (_, r) => r * SIZE + c),
);
const BOX_UNITS: number[][] = Array.from({ length: SIZE }, (_, b) =>
  Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => BOX_OF[i] === b),
);
const ALL_UNITS = [...ROW_UNITS, ...COL_UNITS, ...BOX_UNITS];

const PEERS: number[][] = Array.from({ length: CELL_COUNT }, (_, i) =>
  Array.from({ length: CELL_COUNT }, (_, j) => j).filter(
    (j) =>
      j !== i && (ROW_OF[j] === ROW_OF[i] || COL_OF[j] === COL_OF[i] || BOX_OF[j] === BOX_OF[i]),
  ),
);

const bit = (value: number) => 1 << value;
const ALL_CANDIDATES = VALUES.reduce((mask, v) => mask | bit(v), 0);

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count++;
  return count;
}

function valuesIn(mask: number): number[] {
  return VALUES.filter((v) => mask & bit(v));
}

// --- Basic grid helpers -----------------------------------------------------------------------

/** Assumes `grid[row][col]` is currently empty (0) — callers overwriting an occupied cell should
 * clear it first, then check. */
export function isValidPlacement(grid: Grid, row: number, col: number, value: number): boolean {
  const index = row * SIZE + col;
  for (const peer of PEERS[index]!) {
    if (grid[ROW_OF[peer]!]![COL_OF[peer]!] === value) return false;
  }
  return true;
}

function toFlat(grid: Grid): number[] {
  return grid.flat();
}

function toGrid(flat: readonly number[]): Grid {
  return Array.from({ length: SIZE }, (_, r) => flat.slice(r * SIZE, r * SIZE + SIZE));
}

/** Fills an empty grid into a complete, valid, randomized solution via backtracking. */
export function generateSolvedGrid(rng: () => number): Grid {
  const grid: Grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

  function fill(pos: number): boolean {
    if (pos === CELL_COUNT) return true;
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    for (const value of shuffle(rng, VALUES)) {
      if (isValidPlacement(grid, row, col, value)) {
        grid[row]![col] = value;
        if (fill(pos + 1)) return true;
        grid[row]![col] = 0;
      }
    }
    return false;
  }

  fill(0);
  return grid;
}

/** Counts solutions up to `limit` (then stops early). Picks the most-constrained empty cell
 * first, so even a near-empty grid resolves quickly. */
export function countSolutions(grid: Grid, limit = 2): number {
  const cells = toFlat(grid);
  let count = 0;

  function candidateMask(i: number): number {
    let mask = ALL_CANDIDATES;
    for (const peer of PEERS[i]!) mask &= ~bit(cells[peer]!);
    return mask;
  }

  function solve(): boolean {
    let best = -1;
    let bestMask = 0;
    let bestCount = SIZE + 1;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (cells[i] !== 0) continue;
      const mask = candidateMask(i);
      const n = popcount(mask);
      if (n === 0) return false; // dead end
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return count >= limit;
    }
    for (const value of valuesIn(bestMask)) {
      cells[best] = value;
      if (solve()) return true;
    }
    cells[best] = 0;
    return false;
  }

  // Reject grids whose givens already conflict — they have zero solutions.
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = cells[i]!;
    if (v !== 0 && PEERS[i]!.some((p) => cells[p] === v)) return 0;
  }
  solve();
  return count;
}

/** Self-contained "is this grid fully filled and constraint-valid" check — doesn't need the
 * solution, since a full grid that satisfies every row/column/box is necessarily correct given
 * the puzzle's solution is guaranteed unique at generation time. */
export function isValidCompleteGrid(grid: Grid): boolean {
  const cells = toFlat(grid);
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = cells[i]!;
    if (v === 0) return false;
    for (const peer of PEERS[i]!) if (cells[peer] === v) return false;
  }
  return true;
}

// --- Human-style logical solver ----------------------------------------------------------------

interface SolverState {
  cells: number[];
  candidates: number[];
}

function initState(grid: Grid): SolverState | null {
  const cells = toFlat(grid);
  const candidates = cells.map((v) => (v === 0 ? ALL_CANDIDATES : 0));
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = cells[i]!;
    if (v === 0) continue;
    for (const peer of PEERS[i]!) {
      if (cells[peer] === v) return null; // givens/entries already conflict
      candidates[peer]! &= ~bit(v);
    }
  }
  return { cells, candidates };
}

function place(state: SolverState, index: number, value: number): void {
  state.cells[index] = value;
  state.candidates[index] = 0;
  for (const peer of PEERS[index]!) state.candidates[peer]! &= ~bit(value);
}

interface Placement {
  index: number;
  value: number;
  technique: Technique;
}

function findSingle(state: SolverState): Placement | null {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.cells[i] === 0 && popcount(state.candidates[i]!) === 1) {
      return { index: i, value: valuesIn(state.candidates[i]!)[0]!, technique: "naked-single" };
    }
  }
  for (const unit of ALL_UNITS) {
    for (const value of VALUES) {
      let only = -1;
      let seen = 0;
      for (const i of unit) {
        if (state.cells[i] === value) {
          seen = 2; // already placed in this unit
          break;
        }
        if (state.candidates[i]! & bit(value)) {
          only = i;
          seen++;
        }
      }
      if (seen === 1) return { index: only, value, technique: "hidden-single" };
    }
  }
  return null;
}

/** Removes `mask` from every cell in `targets` not in `keep`; returns whether anything changed. */
function eliminate(
  state: SolverState,
  targets: readonly number[],
  keep: ReadonlySet<number>,
  mask: number,
): boolean {
  let changed = false;
  for (const i of targets) {
    if (keep.has(i) || state.cells[i] !== 0) continue;
    if (state.candidates[i]! & mask) {
      state.candidates[i]! &= ~mask;
      changed = true;
    }
  }
  return changed;
}

/** Pointing (box → row/col) and claiming (row/col → box). */
function applyLockedCandidates(state: SolverState): boolean {
  for (const value of VALUES) {
    const b = bit(value);
    for (const box of BOX_UNITS) {
      const spots = box.filter((i) => state.candidates[i]! & b);
      if (spots.length < 2) continue;
      const keep = new Set(spots);
      if (
        spots.every((i) => ROW_OF[i] === ROW_OF[spots[0]!]) &&
        eliminate(state, ROW_UNITS[ROW_OF[spots[0]!]!]!, keep, b)
      ) {
        return true;
      }
      if (
        spots.every((i) => COL_OF[i] === COL_OF[spots[0]!]) &&
        eliminate(state, COL_UNITS[COL_OF[spots[0]!]!]!, keep, b)
      ) {
        return true;
      }
    }
    for (const line of [...ROW_UNITS, ...COL_UNITS]) {
      const spots = line.filter((i) => state.candidates[i]! & b);
      if (spots.length < 2) continue;
      if (spots.every((i) => BOX_OF[i] === BOX_OF[spots[0]!])) {
        if (eliminate(state, BOX_UNITS[BOX_OF[spots[0]!]!]!, new Set(spots), b)) return true;
      }
    }
  }
  return false;
}

function applyNakedPairs(state: SolverState): boolean {
  for (const unit of ALL_UNITS) {
    const pairs = unit.filter((i) => state.cells[i] === 0 && popcount(state.candidates[i]!) === 2);
    for (let x = 0; x < pairs.length; x++) {
      for (let y = x + 1; y < pairs.length; y++) {
        const mask = state.candidates[pairs[x]!]!;
        if (mask !== state.candidates[pairs[y]!]) continue;
        if (eliminate(state, unit, new Set([pairs[x]!, pairs[y]!]), mask)) return true;
      }
    }
  }
  return false;
}

function applyHiddenPairs(state: SolverState): boolean {
  for (const unit of ALL_UNITS) {
    const spotsByValue = new Map<number, number[]>();
    for (const value of VALUES) {
      const spots = unit.filter((i) => state.candidates[i]! & bit(value));
      if (spots.length === 2) spotsByValue.set(value, spots);
    }
    const entries = [...spotsByValue];
    for (let x = 0; x < entries.length; x++) {
      for (let y = x + 1; y < entries.length; y++) {
        const [v1, s1] = entries[x]!;
        const [v2, s2] = entries[y]!;
        if (s1[0] !== s2[0] || s1[1] !== s2[1]) continue;
        const pairMask = bit(v1) | bit(v2);
        let changed = false;
        for (const i of s1) {
          if (state.candidates[i] !== pairMask) {
            state.candidates[i] = state.candidates[i]! & pairMask;
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

const ELIMINATION_STEPS: { technique: Technique; apply: (state: SolverState) => boolean }[] = [
  { technique: "locked-candidates", apply: applyLockedCandidates },
  { technique: "naked-pair", apply: applyNakedPairs },
  { technique: "hidden-pair", apply: applyHiddenPairs },
];

export interface GradeResult {
  /** True when the human-style solver finished the grid without ever guessing. */
  solved: boolean;
  /** Hardest technique level (1–3) the solve needed; 0 for an already-full grid. */
  level: number;
  /** How many times each technique fired. */
  techniques: Partial<Record<Technique, number>>;
}

/**
 * Solves the way a person would — always the easiest available technique first, never guessing
 * — and reports the hardest technique that was actually needed. `maxLevel` caps which
 * techniques may be used (a puzzle that needs something harder reports `solved: false`).
 */
export function gradePuzzle(grid: Grid, maxLevel = 3): GradeResult {
  const state = initState(grid);
  const techniques: Partial<Record<Technique, number>> = {};
  if (!state) return { solved: false, level: 0, techniques };
  let level = 0;
  const note = (t: Technique) => {
    techniques[t] = (techniques[t] ?? 0) + 1;
    level = Math.max(level, TECHNIQUE_LEVEL[t]);
  };

  for (;;) {
    if (state.cells.every((v) => v !== 0)) return { solved: true, level, techniques };
    if (state.cells.some((v, i) => v === 0 && state.candidates[i] === 0))
      return { solved: false, level, techniques };

    const single = findSingle(state);
    if (single) {
      note(single.technique);
      place(state, single.index, single.value);
      continue;
    }
    const step = ELIMINATION_STEPS.find(
      (s) => TECHNIQUE_LEVEL[s.technique] <= maxLevel && s.apply(state),
    );
    if (!step) return { solved: false, level, techniques };
    note(step.technique);
  }
}

// --- Puzzle carving ---------------------------------------------------------------------------

/** Removes as many cells as possible (up to `maxRemovals`) while keeping a unique solution. */
export function carvePuzzle(solution: Grid, rng: () => number, maxRemovals: number): Grid {
  const puzzle = solution.map((row) => [...row]);
  const cellOrder = shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  );
  let removed = 0;

  for (const index of cellOrder) {
    if (removed >= maxRemovals) break;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const backup = puzzle[row]![col]!;
    puzzle[row]![col] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      removed++;
    } else {
      puzzle[row]![col] = backup;
    }
  }

  return puzzle;
}

interface TierSpec {
  /** Stop carving once the givens drop to this many (or no further removal is allowed). */
  targetGivens: number;
  /** Hardest technique level the puzzle may require. */
  maxLevel: number;
  /** Level the puzzle should ideally require — attempts that reach it are preferred. */
  preferredLevel: number;
  /** How many solution grids to try before settling for the best one found. */
  attempts: number;
}

const TIER_SPECS: Record<PuzzleTier, TierSpec> = {
  // Givens are removed in symmetric pairs, so even targets are the ones actually reachable.
  easy: { targetGivens: 16, maxLevel: 1, preferredLevel: 1, attempts: 8 },
  medium: { targetGivens: 14, maxLevel: 2, preferredLevel: 1, attempts: 8 },
  // Most 6×6 grids fall to singles alone even at 10 givens, so hard days search much wider for
  // one that genuinely needs locked candidates or pairs (~1ms per attempt).
  hard: { targetGivens: 10, maxLevel: 3, preferredLevel: 2, attempts: 40 },
};

export interface GradedPuzzle {
  solution: Grid;
  puzzle: Grid;
  givens: number;
  grade: GradeResult;
}

/**
 * Removes cells in 180°-symmetric pairs (the classic Sudoku look), only accepting a removal when
 * the puzzle stays uniquely solvable *and* still solvable by pure logic within the tier's
 * technique ceiling — so a player never has to guess.
 */
function carveGraded(solution: Grid, rng: () => number, spec: TierSpec): GradedPuzzle {
  const cells = toFlat(solution);
  const seen = new Set<number>();
  const pairs: number[][] = [];
  for (const i of shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, k) => k),
  )) {
    if (seen.has(i)) continue;
    const mirror = CELL_COUNT - 1 - i;
    seen.add(i).add(mirror);
    pairs.push(i === mirror ? [i] : [i, mirror]);
  }

  let givens = CELL_COUNT;
  for (const pair of pairs) {
    if (givens - pair.length < spec.targetGivens) continue;
    const backup = pair.map((i) => cells[i]!);
    for (const i of pair) cells[i] = 0;
    const grid = toGrid(cells);
    if (countSolutions(grid, 2) === 1 && gradePuzzle(grid, spec.maxLevel).solved) {
      givens -= pair.length;
    } else {
      pair.forEach((i, k) => (cells[i] = backup[k]!));
    }
    if (givens <= spec.targetGivens) break;
  }

  const puzzle = toGrid(cells);
  return { solution, puzzle, givens, grade: gradePuzzle(puzzle, spec.maxLevel) };
}

/**
 * Generates a puzzle for a difficulty tier: tries several solution grids and keeps the best
 * match — fewest givens, then reaching the tier's preferred technique level. Deterministic for
 * a given rng.
 */
export function generateGradedPuzzle(rng: () => number, tier: PuzzleTier): GradedPuzzle {
  const spec = TIER_SPECS[tier];
  let best: GradedPuzzle | null = null;
  const score = (p: GradedPuzzle) =>
    (p.givens <= spec.targetGivens ? 100 : -p.givens) +
    (p.grade.level >= spec.preferredLevel ? 10 : 0);

  for (let attempt = 0; attempt < spec.attempts; attempt++) {
    const candidate = carveGraded(generateSolvedGrid(rng), rng, spec);
    if (!best || score(candidate) > score(best)) best = candidate;
    if (best.givens <= spec.targetGivens && best.grade.level >= spec.preferredLevel) break;
  }
  return best!;
}

// --- Hints ------------------------------------------------------------------------------------

/**
 * Suggests the next step for a player's current grid:
 *  1. If `solution` is given and a filled cell disagrees with it, point that cell out first
 *     (`kind: "fix"`, value 0 = clear it) — the move model accepts any placement that doesn't
 *     duplicate a peer, so a legal-but-wrong value can sit in the grid, and every deduction made
 *     on top of it would be unreliable.
 *  2. Otherwise run the human-style solver from the current grid and return the first cell it
 *     can place, with the technique that justifies it.
 *  3. As a last resort (only reachable without a solution-consistent grid, or for puzzles that
 *     need techniques beyond the solver), reveal a blank cell from `solution`.
 */
export function findHint(grid: Grid, solution?: Grid): HintCell | null {
  if (solution) {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const value = grid[row]![col]!;
        if (value !== 0 && value !== solution[row]![col])
          return { row, col, value: 0, kind: "fix" };
      }
    }
  }

  const state = initState(grid);
  if (state && state.cells.some((v) => v === 0)) {
    for (;;) {
      if (state.cells.some((v, i) => v === 0 && state.candidates[i] === 0)) break;
      const single = findSingle(state);
      if (single) {
        const row = ROW_OF[single.index]!;
        const col = COL_OF[single.index]!;
        // Only trust the deduction if it agrees with the known solution (it always will for a
        // solution-consistent grid; this guards hand-built or inconsistent content).
        if (!solution || solution[row]![col] === single.value) {
          return { row, col, value: single.value, kind: "place", technique: single.technique };
        }
        break;
      }
      if (!ELIMINATION_STEPS.some((s) => s.apply(state))) break;
    }
  }

  if (solution) {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (grid[row]![col] === 0) return { row, col, value: solution[row]![col]!, kind: "place" };
      }
    }
  }
  return null;
}
