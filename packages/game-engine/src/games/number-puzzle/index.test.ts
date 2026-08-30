import { describe, it, expect } from "vitest";
import { numberPuzzleGame, type NumberPuzzleMove } from "./index.js";

const DATE = "2026-08-29";

function generate() {
  return numberPuzzleGame.generatePuzzle("unused-seed", DATE);
}

describe("number-puzzle: generatePuzzle", () => {
  it("is deterministic and produces 4 positive-integer numbers plus a target", () => {
    const a = generate();
    const b = generate();
    expect(a).toEqual(b);
    expect(a.numbers).toHaveLength(4);
    expect(a.numbers.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    expect(Number.isInteger(a.target) && a.target > 0).toBe(true);
  });

  it("differs across dates", () => {
    const day1 = numberPuzzleGame.generatePuzzle("s", "2026-08-29");
    const day2 = numberPuzzleGame.generatePuzzle("s", "2026-08-30");
    expect(day1).not.toEqual(day2);
  });
});

describe("number-puzzle: validateAttempt", () => {
  const content = { numbers: [2, 3, 4, 5], target: 20 }; // 4 * 5 = 20

  it("reduces the pool by combining two numbers into their result", () => {
    const moves: NumberPuzzleMove[] = [{ type: "combine", a: 4, b: 5, op: "*" }];
    const result = numberPuzzleGame.validateAttempt(content, moves);
    expect(result.result.pool.sort()).toEqual([2, 3, 20].sort());
    expect(result.complete).toBe(false); // no submit yet
  });

  it("wins when the target is in the pool at submit time", () => {
    const moves: NumberPuzzleMove[] = [{ type: "combine", a: 4, b: 5, op: "*" }, { type: "submit" }];
    const result = numberPuzzleGame.validateAttempt(content, moves);
    expect(result.complete).toBe(true);
    expect(result.won).toBe(true);
  });

  it("loses if the player submits without reaching the target", () => {
    const moves: NumberPuzzleMove[] = [{ type: "combine", a: 2, b: 3, op: "+" }, { type: "submit" }];
    const result = numberPuzzleGame.validateAttempt(content, moves);
    expect(result.complete).toBe(true);
    expect(result.won).toBe(false);
    expect(result.result.gaveUp).toBe(true);
  });

  it("counts referencing a number not currently in the pool as a mistake, without changing the pool", () => {
    const moves: NumberPuzzleMove[] = [{ type: "combine", a: 4, b: 5, op: "*" }, { type: "combine", a: 5, b: 2, op: "+" }];
    const result = numberPuzzleGame.validateAttempt(content, moves);
    // the second move reuses "5", which was already consumed by the first move
    expect(result.mistakes).toBe(1);
    expect(result.result.pool.sort()).toEqual([2, 3, 20].sort());
  });

  it("rejects a subtraction that would go non-positive, and non-exact division, as mistakes", () => {
    const negativeSubtraction: NumberPuzzleMove[] = [{ type: "combine", a: 2, b: 5, op: "-" }];
    expect(numberPuzzleGame.validateAttempt(content, negativeSubtraction).mistakes).toBe(1);

    const inexactDivision: NumberPuzzleMove[] = [{ type: "combine", a: 5, b: 3, op: "/" }];
    expect(numberPuzzleGame.validateAttempt(content, inexactDivision).mistakes).toBe(1);
  });
});

describe("number-puzzle: calculateScore", () => {
  const content = { numbers: [2, 3, 4, 5], target: 20 };

  it("scores a fast, mistake-free win highly", () => {
    const won = numberPuzzleGame.validateAttempt(content, [
      { type: "combine", a: 4, b: 5, op: "*" },
      { type: "submit" },
    ]);
    const score = numberPuzzleGame.calculateScore(content, won.result, { durationMs: 5_000 });
    expect(score.total).toBe(100);
  });

  it("scores a loss at 0", () => {
    const lost = numberPuzzleGame.validateAttempt(content, [{ type: "submit" }]);
    const score = numberPuzzleGame.calculateScore(content, lost.result, { durationMs: 5_000 });
    expect(score.total).toBe(0);
  });
});
