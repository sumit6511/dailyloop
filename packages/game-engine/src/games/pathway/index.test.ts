import { describe, it, expect } from "vitest";
import { speedBonus } from "../../scoring.js";
import { addDaysToKey } from "@dailyloop/shared";
import { tierForDate } from "../../difficulty.js";
import { pathwayGame, type PathwayContent } from "./index.js";
import { solvePathway } from "./generator.js";

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
  it("scales the board with the day's difficulty and is always uniquely solvable", () => {
    const sizes: Record<string, number> = {};
    for (let day = 0; day < 7; day++) {
      const dateKey = addDaysToKey("2026-08-24", day); // Monday..Sunday
      const content = pathwayGame.generatePuzzle("ignored", dateKey);
      expect(content.difficulty).toBe(tierForDate(dateKey));
      expect(solvePathway(content, 2)).toHaveLength(1);
      sizes[content.difficulty!] = content.size;
    }
    expect(sizes.easy).toBeLessThan(sizes.medium!);
    expect(sizes.medium).toBeLessThan(sizes.hard!);
  });

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
    const score = pathwayGame.calculateScore(
      FIXTURE,
      { path: [], mistakes: 0, won: false },
      { durationMs: 10_000 },
    );
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
    const perfect = pathwayGame.calculateScore(
      FIXTURE,
      { path: FIXTURE.solution, mistakes: 0, won: true },
      { durationMs: 10_000 },
    );
    const flawed = pathwayGame.calculateScore(
      FIXTURE,
      { path: FIXTURE.solution, mistakes: 3, won: true },
      { durationMs },
    );
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

describe("hint", () => {
  type Hint = { kind: "extend" | "retreat"; cell: { row: number; col: number } } | null;
  const hintFor = (content: PathwayContent, moves: { row: number; col: number }[]) =>
    pathwayGame.hint!(content, moves) as Hint;

  it("leads from an empty board all the way to a solved puzzle without ever backtracking", () => {
    const content = pathwayGame.generatePuzzle("ignored", "2026-08-30"); // a Sunday: 7x7
    const moves: { row: number; col: number }[] = [];
    for (let step = 0; step <= content.size * content.size; step++) {
      const hint = hintFor(content, moves);
      if (!hint) break;
      expect(hint.kind).toBe("extend");
      moves.push(hint.cell);
    }
    expect(pathwayGame.validateAttempt(content, moves).won).toBe(true);
    expect(hintFor(content, moves)).toBeNull();
  });

  it("points back to the last good cell once the path has left the (unique) solution", () => {
    const content = pathwayGame.generatePuzzle("ignored", "2026-08-24");
    const { solution } = content;
    // Follow the solution until the first point where some *other* legal step exists, take it.
    let moves: { row: number; col: number }[] = [];
    let offTrack: { row: number; col: number } | undefined;
    for (let k = 1; k < solution.length - 1 && !offTrack; k++) {
      moves = solution.slice(0, k);
      const h = moves[k - 1]!;
      offTrack = [
        { row: h.row + 1, col: h.col },
        { row: h.row - 1, col: h.col },
        { row: h.row, col: h.col + 1 },
        { row: h.row, col: h.col - 1 },
      ].find(
        (cell) =>
          !(cell.row === solution[k]!.row && cell.col === solution[k]!.col) &&
          pathwayGame.validateAttempt(content, [...moves, cell]).result.path.length === k + 1,
      );
    }
    const head = moves[moves.length - 1]!;
    expect(offTrack).toBeDefined();
    expect(hintFor(content, [...moves, offTrack!])).toEqual({ kind: "retreat", cell: head });
  });

  it("doesn't send a player back on an older puzzle where their different route still works", () => {
    // No walls and only a start and end: both the row snake and the column snake solve it.
    const legacy: PathwayContent = {
      size: 3,
      checkpoints: [
        { row: 0, col: 0 },
        { row: 2, col: 2 },
      ],
      walls: [],
      solution: FIXTURE.solution.slice(0, 6).concat([
        { row: 2, col: 0 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
      ]),
    };
    const columnSnakeStart = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
    ];
    expect(hintFor(legacy, columnSnakeStart)).toEqual({ kind: "extend", cell: { row: 2, col: 0 } });
    // The same position on a tiered (unique-by-construction) puzzle trusts the stored solution.
    expect(hintFor({ ...legacy, difficulty: "easy" }, columnSnakeStart)).toEqual({
      kind: "retreat",
      cell: { row: 0, col: 0 },
    });
  });

  it("deducts for hints and withholds the flawless bonus", () => {
    const meta = { durationMs: 10_000 };
    const result = { path: FIXTURE.solution, mistakes: 0, won: true };
    const unaided = pathwayGame.calculateScore(FIXTURE, result, meta);
    const helped = pathwayGame.calculateScore(FIXTURE, result, { ...meta, hintsUsed: 1 });
    expect(helped.hintPenalty).toBeGreaterThan(0);
    expect(helped.accuracyBonus).toBe(0);
    expect(helped.total).toBeLessThan(unaided.total);
  });
});

describe("solvePathway with a prefix", () => {
  it("only returns completions of the given partial path, and none for a dead end", () => {
    const content = pathwayGame.generatePuzzle("ignored", "2026-08-24");
    const prefix = content.solution.slice(0, 5);
    expect(solvePathway(content, 2, { prefix })).toEqual([content.solution]);
    expect(solvePathway(content, 1, { prefix: [content.solution[1]!] })).toEqual([]); // must start on 1
  });
});
