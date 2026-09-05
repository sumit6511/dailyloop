import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import { SIZE, generateSolvedGrid, carvePuzzle, isValidCompleteGrid, findHint, type Grid } from "./sudoku.js";

describe("generateSolvedGrid", () => {
  it("produces a valid complete 6x6 Sudoku (unique per row, column, and 2x3 box)", () => {
    const grid = generateSolvedGrid(createRng("sudoku-seed"));
    expect(isValidCompleteGrid(grid)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = generateSolvedGrid(createRng("same-seed"));
    const b = generateSolvedGrid(createRng("same-seed"));
    expect(a).toEqual(b);
  });
});

describe("carvePuzzle", () => {
  it("removes cells while every remaining clue still matches the solution", () => {
    const solution = generateSolvedGrid(createRng("carve-seed"));
    const puzzle = carvePuzzle(solution, createRng("carve-seed-2"), 16);

    const blanks = puzzle.flat().filter((v) => v === 0).length;
    expect(blanks).toBeGreaterThan(0);
    expect(blanks).toBeLessThanOrEqual(16);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (puzzle[r]![c] !== 0) expect(puzzle[r]![c]).toBe(solution[r]![c]);
      }
    }
  });
});

describe("isValidCompleteGrid", () => {
  const solution = generateSolvedGrid(createRng("complete-grid-seed"));

  it("accepts a genuinely complete, valid grid", () => {
    expect(isValidCompleteGrid(solution.map((row) => [...row]))).toBe(true);
  });

  it("rejects an incomplete grid", () => {
    const incomplete = solution.map((row) => [...row]);
    incomplete[0]![0] = 0;
    expect(isValidCompleteGrid(incomplete)).toBe(false);
  });

  it("rejects a full grid with a duplicate in a row", () => {
    const invalid = solution.map((row) => [...row]);
    invalid[0]![1] = invalid[0]![0]!; // guaranteed duplicate within row 0
    expect(isValidCompleteGrid(invalid)).toBe(false);
  });
});

describe("findHint", () => {
  it("finds a naked single — an empty cell with exactly one legal candidate", () => {
    const solution = generateSolvedGrid(createRng("naked-single-seed"));
    const grid: Grid = solution.map((row) => [...row]);
    const target = { row: 2, col: 2 };
    grid[target.row]![target.col] = 0; // every other cell stays filled, so only one value can fit here

    const hint = findHint(grid);
    expect(hint).toEqual({ row: target.row, col: target.col, value: solution[target.row]![target.col] });
  });

  it("finds a hidden single — a value that only fits one empty cell in a row, even with other candidates open", () => {
    const solution = generateSolvedGrid(createRng("hidden-single-seed"));
    const grid: Grid = solution.map((row) => [...row]);
    // Blank two cells in row 0: the naked-single case is avoided (each blank has >1 raw
    // candidate) but the solution's own value for one of them should still be the only
    // legal fit for that specific value once column/box constraints from the rest of the
    // solved grid are taken into account.
    const [r, c1, c2] = [0, 0, 1];
    grid[r]![c1] = 0;
    grid[r]![c2] = 0;

    const hint = findHint(grid);
    expect(hint).not.toBeNull();
    expect(hint!.row).toBe(r);
    expect([c1, c2]).toContain(hint!.col);
    expect(hint!.value).toBe(solution[r]![hint!.col]);
  });

  it("falls back to the solution when no cell is currently deducible", () => {
    const solution = generateSolvedGrid(createRng("fallback-seed"));
    const empty: Grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    // An entirely empty grid has zero constraints — every value is a legal candidate
    // everywhere, so neither naked nor hidden singles exist, forcing the fallback path.
    const hint = findHint(empty, solution);
    expect(hint).not.toBeNull();
    expect(hint!.value).toBe(solution[hint!.row]![hint!.col]);
  });

  it("returns null when the grid is already complete", () => {
    expect(findHint(solutionCopy(), solutionCopy())).toBeNull();
  });

  function solutionCopy(): Grid {
    return generateSolvedGrid(createRng("already-complete-seed")).map((row) => [...row]);
  }
});
