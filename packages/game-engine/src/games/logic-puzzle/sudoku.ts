import { shuffle } from "../../rng.js";

export const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const VALUES = [1, 2, 3, 4, 5, 6];

export type Grid = number[][];

function isValidPlacement(grid: Grid, row: number, col: number, value: number): boolean {
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
