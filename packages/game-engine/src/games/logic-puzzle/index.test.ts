import { describe, it, expect } from "vitest";
import { logicPuzzleGame, type LogicPuzzleContent, type LogicPuzzleMove } from "./index.js";

// A fully valid 6x6 Sudoku, reused across tests as either a solution or a plain move sequence —
// since validateAttempt's constraint-rejection logic no longer reads `content.solution` at all
// (only `hint()`'s defensive fallback does), an all-blank `puzzle` with no real given clues is a
// clean, uniqueness-agnostic way to test the replay logic in isolation.
const VALID_GRID = [
  [1, 2, 3, 4, 5, 6],
  [4, 5, 6, 1, 2, 3],
  [2, 3, 1, 5, 6, 4],
  [5, 6, 4, 2, 3, 1],
  [3, 1, 2, 6, 4, 5],
  [6, 4, 5, 3, 1, 2],
];
const BLANK_PUZZLE = Array.from({ length: 6 }, () => Array(6).fill(0));

describe("logic-puzzle: generatePuzzle", () => {
  it("is deterministic and produces a puzzle consistent with its own solution", () => {
    const a = logicPuzzleGame.generatePuzzle("s", "2026-08-29");
    const b = logicPuzzleGame.generatePuzzle("s", "2026-08-29");
    expect(a).toEqual(b);

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (a.puzzle[r]![c] !== 0) expect(a.puzzle[r]![c]).toBe(a.solution[r]![c]);
      }
    }
  });
});

describe("logic-puzzle: validateAttempt", () => {
  const content: LogicPuzzleContent = { solution: VALID_GRID, puzzle: BLANK_PUZZLE };

  it("wins when every cell is filled with a globally valid arrangement", () => {
    const moves: LogicPuzzleMove[] = VALID_GRID.flatMap((row, r) => row.map((value, c) => ({ row: r, col: c, value })));
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.mistakes).toBe(0);
  });

  it("rejects a placement that duplicates a value already in its row, without committing it", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: 1 },
      { row: 0, col: 1, value: 1 }, // same row as (0,0)
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[0]![1]).toBe(0); // rejected — left blank
    expect(result.mistakes).toBe(1);
  });

  it("rejects a placement that duplicates a value already in its column, without committing it", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: 1 },
      { row: 1, col: 0, value: 1 }, // same column as (0,0)
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[1]![0]).toBe(0);
    expect(result.mistakes).toBe(1);
  });

  it("rejects a placement that duplicates a value already in its box, without committing it", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: 1 },
      { row: 1, col: 1, value: 1 }, // same 2x3 box as (0,0), different row and column
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[1]![1]).toBe(0);
    expect(result.mistakes).toBe(1);
  });

  it("lets a corrected placement land cleanly after a rejected attempt", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: 1 },
      { row: 0, col: 1, value: 1 }, // rejected — row conflict
      { row: 0, col: 1, value: 2 }, // now fine
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[0]![1]).toBe(2);
    expect(result.mistakes).toBe(1); // only the one rejected attempt counts
  });

  it("erasing is always free, never a mistake", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: 1 },
      { row: 0, col: 0, value: 0 },
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[0]![0]).toBe(0);
    expect(result.mistakes).toBe(0);
  });

  it("ignores an attempt to overwrite a given (non-blank) clue", () => {
    const withGiven: LogicPuzzleContent = { solution: VALID_GRID, puzzle: VALID_GRID.map((row, r) => row.map((v, c) => (r === 1 && c === 0 ? 0 : v))) };
    const result = logicPuzzleGame.validateAttempt(withGiven, [{ row: 0, col: 0, value: 5 }]); // (0,0) is a given clue, value 1
    expect(result.result.grid[0]![0]).toBe(1);
    expect(result.mistakes).toBe(0);
  });

  it("is not complete while any cell remains blank", () => {
    const result = logicPuzzleGame.validateAttempt(content, [{ row: 0, col: 0, value: 1 }]);
    expect(result.complete).toBe(false);
  });
});

describe("logic-puzzle: hint", () => {
  it("suggests a legal, currently-deducible cell mid-game", () => {
    // Every cell given except (2,2) — a guaranteed naked single.
    const puzzle = VALID_GRID.map((row, r) => row.map((v, c) => (r === 2 && c === 2 ? 0 : v)));
    const content: LogicPuzzleContent = { solution: VALID_GRID, puzzle };
    const suggestion = logicPuzzleGame.hint!(content, []) as { row: number; col: number; value: number } | null;
    expect(suggestion).toEqual({ row: 2, col: 2, value: VALID_GRID[2]![2] });
  });

  it("returns null once the grid is already complete", () => {
    const content: LogicPuzzleContent = { solution: VALID_GRID, puzzle: VALID_GRID };
    expect(logicPuzzleGame.hint!(content, [])).toBeNull();
  });
});

describe("logic-puzzle: calculateScore", () => {
  const content: LogicPuzzleContent = { solution: VALID_GRID, puzzle: BLANK_PUZZLE };

  it("scores a flawless fast solve at the maximum", () => {
    const score = logicPuzzleGame.calculateScore(content, { grid: VALID_GRID, mistakes: 0, won: true }, { durationMs: 10_000 });
    expect(score.total).toBe(100);
  });

  it("scores 0 for an unfinished attempt", () => {
    const score = logicPuzzleGame.calculateScore(content, { grid: BLANK_PUZZLE, mistakes: 0, won: false }, { durationMs: 10_000 });
    expect(score.total).toBe(0);
  });

  it("penalizes mistakes below a flawless solve", () => {
    const perfect = logicPuzzleGame.calculateScore(content, { grid: VALID_GRID, mistakes: 0, won: true }, { durationMs: 10_000 });
    const flawed = logicPuzzleGame.calculateScore(content, { grid: VALID_GRID, mistakes: 3, won: true }, { durationMs: 10_000 });
    expect(flawed.total).toBeLessThan(perfect.total);
    expect(flawed.mistakePenalty).toBe(24);
    expect(flawed.accuracyBonus).toBe(0);
  });
});
