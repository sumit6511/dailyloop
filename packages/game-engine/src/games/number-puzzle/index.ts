import { z } from "zod";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng, randInt } from "../../rng.js";
import { tierForDate, type PuzzleTier } from "../../difficulty.js";
import { analyzeNumbers, applyOp, type NumberOp } from "./solver.js";

export type { NumberOp };

export interface NumberPuzzleContent {
  numbers: number[];
  target: number;
  /** Server-only until the attempt is complete — one way to reach the target. Absent on puzzles
   * generated before this existed. */
  solution?: string;
  difficulty?: PuzzleTier;
}

export type NumberPuzzleMove =
  { type: "combine"; a: number; b: number; op: NumberOp } | { type: "submit" };

export interface NumberPuzzleStep {
  a: number;
  b: number;
  op: NumberOp;
  result: number;
}

export interface NumberPuzzleResult {
  pool: number[];
  steps: NumberPuzzleStep[];
  mistakes: number;
  won: boolean;
  gaveUp: boolean;
}

const NUMBER_COUNT = 4;
const NUMBER_MIN = 1;
const NUMBER_MAX = 12;
const MAX_DRAWS = 200;

interface TierSpec {
  targetMin: number;
  targetMax: number;
  /** The target must not be reachable with fewer of the starting numbers than this. */
  minNumbers: number;
  /** Bounds on how many distinct expressions reach the target — fewer is harder. */
  minWays: number;
  maxWays: number;
}

// Easy days have small targets with lots of routes to them; hard days need all four numbers and
// have only one or two distinct ways to get there. No target can ever be hit in one operation.
const TIER_SPECS: Record<PuzzleTier, TierSpec> = {
  easy: { targetMin: 15, targetMax: 60, minNumbers: 3, minWays: 4, maxWays: Infinity },
  medium: { targetMin: 25, targetMax: 99, minNumbers: 4, minWays: 2, maxWays: 8 },
  hard: { targetMin: 40, targetMax: 150, minNumbers: 4, minWays: 1, maxWays: 2 },
};

function replay(
  content: NumberPuzzleContent,
  moves: NumberPuzzleMove[],
): ValidationResult<NumberPuzzleResult> {
  let pool = [...content.numbers];
  const steps: NumberPuzzleStep[] = [];
  let mistakes = 0;
  let submitted = false;
  let won = false;

  for (const move of moves) {
    if (move.type === "submit") {
      submitted = true;
      won = pool.includes(content.target);
      break;
    }
    const idxA = pool.indexOf(move.a);
    if (idxA === -1) {
      mistakes++;
      continue;
    }
    const withoutA = [...pool.slice(0, idxA), ...pool.slice(idxA + 1)];
    const idxB = withoutA.indexOf(move.b);
    if (idxB === -1) {
      mistakes++;
      continue;
    }
    const remaining = [...withoutA.slice(0, idxB), ...withoutA.slice(idxB + 1)];
    const result = applyOp(move.a, move.b, move.op);
    if (result === null) {
      mistakes++;
      continue;
    }
    pool = [...remaining, result];
    steps.push({ a: move.a, b: move.b, op: move.op, result });
  }

  const gaveUp = submitted && !won;
  return { won, complete: submitted, mistakes, result: { pool, steps, mistakes, won, gaveUp } };
}

export const numberPuzzleGame: DailyGameModule<
  NumberPuzzleContent,
  NumberPuzzleMove,
  NumberPuzzleResult
> = {
  id: "number-puzzle",
  name: "Number Puzzle",
  description: "Reach the target using numbers and operators.",
  icon: "🔢",
  difficulty: "medium",

  contentSchema: z.object({
    numbers: z.array(z.number().int().positive()).length(NUMBER_COUNT),
    target: z.number().int().positive(),
    solution: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  }),

  moveSchema: z.union([
    z.object({
      type: z.literal("combine"),
      a: z.number(),
      b: z.number(),
      op: z.enum(["+", "-", "*", "/"]),
    }),
    z.object({ type: z.literal("submit") }),
  ]),

  generatePuzzle(_seed, dateKey) {
    const difficulty = tierForDate(dateKey);
    const spec = TIER_SPECS[difficulty];
    const rng = createRng(`number-puzzle-${dateKey}`);
    let fallback: NumberPuzzleContent | null = null;

    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const numbers = Array.from({ length: NUMBER_COUNT }, () =>
        randInt(rng, NUMBER_MIN, NUMBER_MAX),
      );
      const candidates: { target: number; expression: string }[] = [];
      for (const [value, info] of analyzeNumbers(numbers)) {
        if (value < spec.targetMin || value > spec.targetMax || info.minNumbers < spec.minNumbers)
          continue;
        if (info.ways >= spec.minWays && info.ways <= spec.maxWays)
          candidates.push({ target: value, expression: info.expression });
        else fallback ??= { numbers, target: value, solution: info.expression, difficulty };
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.target - b.target); // Map order isn't part of the contract
        const pick = candidates[randInt(rng, 0, candidates.length - 1)]!;
        return { numbers, target: pick.target, solution: pick.expression, difficulty };
      }
    }
    // Practically unreachable (each tier matches within a handful of draws), but never fail a
    // day's generation over it — settle for a target that at least needs enough numbers.
    if (fallback) return fallback;
    return { numbers: [2, 3, 4, 5], target: 26, solution: "(2 × 3) + (4 × 5)", difficulty };
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) return buildScoreBreakdown({ base: 0 });
    return buildScoreBreakdown({
      base: 60,
      accuracyBonus: result.steps.length > 0 && result.mistakes === 0 ? 15 : 0,
      mistakePenalty: result.mistakes * 5,
      speedBonus: speedBonus(meta.durationMs, 30_000, 240_000, 25),
    });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return {
        numbers: content.numbers,
        target: content.target,
        difficulty: content.difficulty,
        pool: content.numbers,
        steps: [],
        complete: false,
      };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      numbers: content.numbers,
      target: content.target,
      pool: result.pool,
      steps: result.steps,
      difficulty: content.difficulty,
      complete,
      won: complete ? result.won : undefined,
      ...(complete && content.solution ? { solution: content.solution } : {}),
    };
  },
};
