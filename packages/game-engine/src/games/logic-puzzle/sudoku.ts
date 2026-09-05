import { shuffle } from "../../rng.js";

export const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const VALUES = [1, 2, 3, 4, 5, 6];

export type Grid = number[][];

export interface HintCell {
  row: number;
  col: number;
  value: number;
}

/** Assumes `grid[row][col]` is currently empty (0) — callers overwriting an occupied cell should
 * clear it first, then check. */
export function isValidPlacement(grid: Grid, row: number, col: number, value: number): boolean {
  for (let c = 0; c < SIZE; c++) if (grid[row]![c] === value) return false;
  for (let r = 0; r < SIZE; r++) if (grid[r]![col] === value) return false;
  const boxRow = Math.floor(row / BOX_ROWS) * BOX_ROWS;
  const boxCol = Math.floor(col / BOX_COLS) * BOX_COLS;
  for (let r = boxRow; r < boxRow + BOX_ROWS; r++) {
    for (let c = boxCol; c < boxCol + BOX_COLS; c++) {
      if (grid[r]![c] === value) return false;
    }
  }
  return true;
}

/** Fills an empty grid into a complete, valid, randomized solution via backtracking. */
export function generateSolvedGrid(rng: () => number): Grid {
  const grid: Grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

  function fill(pos: number): boolean {
    if (pos === SIZE * SIZE) return true;
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

/** Counts solutions up to `limit` (then stops early) — used to verify a puzzle has exactly one. */
function countSolutions(grid: Grid, limit: number): number {
  const working = grid.map((row) => [...row]);
  let count = 0;

  function solve(pos: number): boolean {
    if (pos === SIZE * SIZE) {
      count++;
      return count >= limit;
    }
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    if (working[row]![col] !== 0) return solve(pos + 1);
    for (let value = 1; value <= SIZE; value++) {
      if (isValidPlacement(working, row, col, value)) {
        working[row]![col] = value;
        if (solve(pos + 1)) return true;
        working[row]![col] = 0;
      }
    }
    return false;
  }

  solve(0);
  return count;
}

/** Removes as many cells as possible (up to `maxRemovals`) while keeping a unique solution. */
export function carvePuzzle(solution: Grid, rng: () => number, maxRemovals: number): Grid {
  const puzzle = solution.map((row) => [...row]);
  const cellOrder = shuffle(
    rng,
    Array.from({ length: SIZE * SIZE }, (_, i) => i),
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

/** Self-contained "is this grid fully filled and constraint-valid" check — doesn't need the
 * solution, since a full grid that satisfies every row/column/box is necessarily correct given
 * the puzzle's solution is guaranteed unique at generation time. */
export function isValidCompleteGrid(grid: Grid): boolean {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = grid[row]![col]!;
      if (value === 0) return false;
      grid[row]![col] = 0;
      const ok = isValidPlacement(grid, row, col, value);
      grid[row]![col] = value;
      if (!ok) return false;
    }
  }
  return true;
}

function candidatesFor(grid: Grid, row: number, col: number): number[] {
  if (grid[row]![col] !== 0) return [];
  return VALUES.filter((v) => isValidPlacement(grid, row, col, v));
}

function rowCells(row: number): [number, number][] {
  return Array.from({ length: SIZE }, (_, c) => [row, c]);
}

function colCells(col: number): [number, number][] {
  return Array.from({ length: SIZE }, (_, r) => [r, col]);
}

function boxCells(boxRow: number, boxCol: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = boxRow; r < boxRow + BOX_ROWS; r++) {
    for (let c = boxCol; c < boxCol + BOX_COLS; c++) cells.push([r, c]);
  }
  return cells;
}

/** An empty cell with exactly one legal candidate — always correct in any valid completion. */
function findNakedSingle(grid: Grid): HintCell | null {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const candidates = candidatesFor(grid, row, col);
      if (candidates.length === 1) return { row, col, value: candidates[0]! };
    }
  }
  return null;
}

function findHiddenSingleInGroup(grid: Grid, cells: [number, number][]): HintCell | null {
  for (const value of VALUES) {
    const fits = cells.filter(([r, c]) => grid[r]![c] === 0 && isValidPlacement(grid, r, c, value));
    if (fits.length === 1) {
      const [row, col] = fits[0]!;
      return { row, col, value };
    }
  }
  return null;
}

/** A value that only legally fits one empty cell within some row/column/box — also always
 * correct in any valid completion, even when that cell has other candidates too. */
function findHiddenSingle(grid: Grid): HintCell | null {
  for (let row = 0; row < SIZE; row++) {
    const found = findHiddenSingleInGroup(grid, rowCells(row));
    if (found) return found;
  }
  for (let col = 0; col < SIZE; col++) {
    const found = findHiddenSingleInGroup(grid, colCells(col));
    if (found) return found;
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_ROWS) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_COLS) {
      const found = findHiddenSingleInGroup(grid, boxCells(boxRow, boxCol));
      if (found) return found;
    }
  }
  return null;
}

/** Picks a cell+value the player can legally deduce right now — naked single first, then hidden
 * single, falling back to revealing any blank cell from `solution` in the rare case neither
 * technique finds anything (these puzzles remove at most 16 of 36 cells, mild enough that this
 * fallback is defensive rather than the common path). */
export function findHint(grid: Grid, solution?: Grid): HintCell | null {
  const naked = findNakedSingle(grid);
  if (naked) return naked;
  const hidden = findHiddenSingle(grid);
  if (hidden) return hidden;
  if (solution) {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (grid[row]![col] === 0) return { row, col, value: solution[row]![col]! };
      }
    }
  }
  return null;
}
