import { describe, it, expect } from "vitest";
import { speedBonus } from "../../scoring.js";
import { pathwayGame, type PathwayContent } from "./index.js";

// A hand-built 3x3 fixture (not the real generator) so behavior tests reason about known
// input/output, matching the convention used by logic-puzzle's own tests.
//
//   (0,0) - (0,1) - (0,2)
//                     |
//   (1,0) - (1,1) - (1,2)
//     |
//   (2,0) - (2,1) - (2,2)
//
// Solution path: (0,0)->(0,1)->(0,2)->(1,2)->(1,1)->(1,0)->(2,0)->(2,1)->(2,2)
// Checkpoints:   1=(0,0)        2=(1,1)                            3=(2,2)
// Wall: (0,0)-(1,0) — a grid-adjacent pair the solution never steps between.
const FIXTURE: PathwayContent = {
  size: 3,
  checkpoints: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
  ],
  walls: [{ a: { row: 0, col: 0 }, b: { row: 1, col: 0 } }],
  solution: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 2 },
    { row: 1, col: 1 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ],
};

describe("generatePuzzle", () => {
  it("is deterministic for the same seed and dateKey", () => {
    const a = pathwayGame.generatePuzzle("ignored", "2026-01-01");
    const b = pathwayGame.generatePuzzle("ignored", "2026-01-01");
    expect(a).toEqual(b);
  });

  it("produces a solution that validateAttempt itself accepts as a win", () => {
    const content = pathwayGame.generatePuzzle("ignored", "2026-01-02") as PathwayContent;
    const result = pathwayGame.validateAttempt(content, content.solution);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.mistakes).toBe(0);
  });
});

describe("validateAttempt", () => {
  it("wins on a full correct replay of the solution", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, FIXTURE.solution);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.mistakes).toBe(0);
    expect(result.result.path).toEqual(FIXTURE.solution);
  });

  it("ignores a first move that isn't checkpoint 1", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 1, col: 1 }, // not checkpoint 1 — ignored
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(result.result.path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(result.mistakes).toBe(0);
  });

  it("retreats one step when the move lands back on the second-to-last cell", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 1 }, // retreat
    ]);
    expect(result.result.path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(result.mistakes).toBe(0);
  });

  it("restarts back to the first cell when the move lands back on the start", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 0, col: 0 }, // restart
    ]);
    expect(result.result.path).toEqual([{ row: 0, col: 0 }]);
    expect(result.mistakes).toBe(0);
  });

  it("counts a mistake and rejects the move when it would cross a wall", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 1, col: 0 }, // walled off from (0,0)
    ]);
    expect(result.result.path).toEqual([{ row: 0, col: 0 }]);
    expect(result.mistakes).toBe(1);
  });

  it("counts a mistake and rejects the move when it revisits a non-adjacent-special cell", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 0, col: 1 }, // already visited, but neither the start nor second-to-last
    ]);
    expect(result.result.path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 1, col: 1 },
    ]);
    expect(result.mistakes).toBe(1);
  });

  it("counts a mistake and rejects touching a checkpoint out of order", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 }, // checkpoint 3, before checkpoint 2 has been visited
    ]);
    expect(result.result.path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ]);
    expect(result.mistakes).toBe(1);
  });

  it("counts a mistake when the final checkpoint is reached before the grid is full", () => {
    const result = pathwayGame.validateAttempt(FIXTURE, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 }, // checkpoint 2, in order
      { row: 2, col: 1 },
      { row: 2, col: 2 }, // checkpoint 3, in order but the grid isn't full yet
    ]);
    expect(result.result.path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ]);
    expect(result.mistakes).toBe(1);
  });
});

describe("calculateScore", () => {
  it("scores 0 for an unfinished attempt", () => {
    const score = pathwayGame.calculateScore(FIXTURE, { path: [], mistakes: 0, won: false }, { durationMs: 10_000 });
    expect(score.total).toBe(0);
  });

  it("scores a flawless fast solve at the maximum", () => {
    const score = pathwayGame.calculateScore(
      FIXTURE,
      { path: FIXTURE.solution, mistakes: 0, won: true },
      { durationMs: 10_000 },
    );
    expect(score.total).toBe(100);
  });

  it("penalizes mistakes and slower completion below a flawless solve", () => {
    const durationMs = 200_000;
    const perfect = pathwayGame.calculateScore(FIXTURE, { path: FIXTURE.solution, mistakes: 0, won: true }, { durationMs: 10_000 });
    const flawed = pathwayGame.calculateScore(FIXTURE, { path: FIXTURE.solution, mistakes: 3, won: true }, { durationMs });
    expect(flawed.total).toBeLessThan(perfect.total);
    expect(flawed.mistakePenalty).toBe(24);
    expect(flawed.accuracyBonus).toBe(0);
    expect(flawed.speedBonus).toBe(speedBonus(durationMs, 45_000, 360_000, 20));
  });
});

describe("sanitizeForClient", () => {
  it("never reveals the solution, and withholds mistakes/won until complete", () => {
    const inProgress = pathwayGame.sanitizeForClient(FIXTURE, {
      status: "IN_PROGRESS",
      moves: [FIXTURE.checkpoints[0]!],
    }) as Record<string, unknown>;
    expect(inProgress.solution).toBeUndefined();
    expect(inProgress.mistakes).toBeUndefined();
    expect(inProgress.won).toBeUndefined();
    expect(inProgress.checkpoints).toEqual(FIXTURE.checkpoints);
    expect(inProgress.walls).toEqual(FIXTURE.walls);

    const completed = pathwayGame.sanitizeForClient(FIXTURE, {
      status: "COMPLETED",
      moves: FIXTURE.solution,
    }) as Record<string, unknown>;
    expect(completed.solution).toBeUndefined();
    expect(completed.won).toBe(true);
    expect(completed.mistakes).toBe(0);
  });

  it("reveals nothing beyond checkpoints/walls/empty path before an attempt starts", () => {
    const notStarted = pathwayGame.sanitizeForClient(FIXTURE, null) as Record<string, unknown>;
    expect(notStarted).toEqual({
      size: FIXTURE.size,
      checkpoints: FIXTURE.checkpoints,
      walls: FIXTURE.walls,
      path: [],
      complete: false,
    });
  });
});
