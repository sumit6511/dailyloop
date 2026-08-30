import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import { SIZE, generateSolvedGrid, carvePuzzle } from "./sudoku.js";

function isValidCompleteGrid(grid: number[][]): boolean {
  const target = new Set([1, 2, 3, 4, 5, 6]);
  for (let r = 0; r < SIZE; r++) {
    if (!setsEqual(new Set(grid[r]), target)) return false;
  }
  for (let c = 0; c < SIZE; c++) {
    const col = grid.map((row) => row[c]!);
    if (!setsEqual(new Set(col), target)) return false;
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += 2) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += 3) {
      const box: number[] = [];
      for (let r = boxRow; r < boxRow + 2; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) box.push(grid[r]![c]!);
      }
      if (!setsEqual(new Set(box), target)) return false;
    }
  }
  return true;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((v) => b.has(v));
}

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
