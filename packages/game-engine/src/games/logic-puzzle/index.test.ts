import { describe, it, expect } from "vitest";
import { logicPuzzleGame, type LogicPuzzleContent, type LogicPuzzleMove } from "./index.js";

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
  // A hand-built, easy-to-reason-about puzzle for behavior tests (independent of the real generator).
  const solution = [
    [1, 2, 3, 4, 5, 6],
    [4, 5, 6, 1, 2, 3],
    [2, 3, 1, 5, 6, 4],
    [5, 6, 4, 2, 3, 1],
    [3, 1, 2, 6, 4, 5],
    [6, 4, 5, 3, 1, 2],
  ];
  const puzzle = solution.map((row, r) => row.map((v, c) => ((r === 0 && c === 0) || (r === 5 && c === 5) ? 0 : v)));
  const content: LogicPuzzleContent = { solution, puzzle };

  it("wins when every blank is filled correctly", () => {
    const moves: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: solution[0]![0]! },
      { row: 5, col: 5, value: solution[5]![5]! },
    ];
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.mistakes).toBe(0);
  });

  it("counts an incorrect fill as a mistake even if later corrected", () => {
    const wrongThenRight: LogicPuzzleMove[] = [
      { row: 0, col: 0, value: ((solution[0]![0]! % 6) + 1) as number }, // guaranteed wrong value
      { row: 0, col: 0, value: solution[0]![0]! }, // corrected
      { row: 5, col: 5, value: solution[5]![5]! },
    ];
    const result = logicPuzzleGame.validateAttempt(content, wrongThenRight);
    expect(result.won).toBe(true);
    expect(result.mistakes).toBe(1);
  });

  it("ignores an attempt to overwrite a given (non-blank) clue", () => {
    const moves: LogicPuzzleMove[] = [{ row: 1, col: 0, value: 1 }]; // (1,0) is a given clue, value 4
    const result = logicPuzzleGame.validateAttempt(content, moves);
    expect(result.result.grid[1]![0]).toBe(4);
    expect(result.mistakes).toBe(0);
  });

  it("is not complete while any cell remains blank", () => {
    const result = logicPuzzleGame.validateAttempt(content, [{ row: 0, col: 0, value: solution[0]![0]! }]);
    expect(result.complete).toBe(false);
  });
});

describe("logic-puzzle: calculateScore", () => {
  const solution = [
    [1, 2, 3, 4, 5, 6],
    [4, 5, 6, 1, 2, 3],
    [2, 3, 1, 5, 6, 4],
    [5, 6, 4, 2, 3, 1],
    [3, 1, 2, 6, 4, 5],
    [6, 4, 5, 3, 1, 2],
  ];
  const puzzle = solution.map((row, r) => row.map((v, c) => (r === 0 && c === 0 ? 0 : v)));
  const content: LogicPuzzleContent = { solution, puzzle };

  it("scores a flawless fast solve at the maximum", () => {
    const won = logicPuzzleGame.validateAttempt(content, [{ row: 0, col: 0, value: solution[0]![0]! }]);
    const score = logicPuzzleGame.calculateScore(content, won.result, { durationMs: 10_000 });
    expect(score.total).toBe(100);
  });
});
