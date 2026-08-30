import { z } from "zod";
import { dateKeyToJSDate } from "@dailyloop/shared";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng, randInt } from "../../rng.js";

export type NumberOp = "+" | "-" | "*" | "/";

export interface NumberPuzzleContent {
  numbers: number[];
  target: number;
}

export type NumberPuzzleMove = { type: "combine"; a: number; b: number; op: NumberOp } | { type: "submit" };

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

const TARGET_MIN = 15;
const TARGET_MAX = 99;
const NUMBER_COUNT = 4;
const NUMBER_MIN = 1;
const NUMBER_MAX = 12;

/** Classic Countdown-numbers constraint: only positive integer results are allowed. */
function applyOp(a: number, b: number, op: NumberOp): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b > 0 ? a - b : null;
    case "*":
      return a * b;
    case "/":
      return b !== 0 && a % b === 0 ? a / b : null;
    default:
      return null;
  }
}

const ALL_OPS: NumberOp[] = ["+", "-", "*", "/"];

/** Every value reachable by combining any subset of `numbers` via the four operators. */
function findReachableValues(numbers: number[]): Set<number> {
  function combine(pool: number[]): Set<number> {
    const reachable = new Set<number>(pool);
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue;
        const rest = pool.filter((_, idx) => idx !== i && idx !== j);
        const a = pool[i]!;
        const b = pool[j]!;
        for (const op of ALL_OPS) {
          const result = applyOp(a, b, op);
          if (result === null) continue;
          for (const v of combine([...rest, result])) reachable.add(v);
        }
      }
    }
    return reachable;
  }
  return combine(numbers);
}

function replay(content: NumberPuzzleContent, moves: NumberPuzzleMove[]): ValidationResult<NumberPuzzleResult> {
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

function daysSinceEpoch(dateKey: string): number {
  return Math.floor(dateKeyToJSDate(dateKey).getTime() / 86_400_000);
}

export const numberPuzzleGame: DailyGameModule<NumberPuzzleContent, NumberPuzzleMove, NumberPuzzleResult> = {
  id: "number-puzzle",
  name: "Number Puzzle",
  description: "Reach the target using numbers and operators.",
  icon: "🔢",
  difficulty: "medium",

  contentSchema: z.object({
    numbers: z.array(z.number().int().positive()).length(NUMBER_COUNT),
    target: z.number().int().positive(),
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
    const rng = createRng(`number-puzzle-${dateKey}-${daysSinceEpoch(dateKey)}`);
    let numbers: number[] = [];
    let inRangeCandidates: number[] = [];

    for (let attempt = 0; attempt < 50 && inRangeCandidates.length === 0; attempt++) {
      numbers = Array.from({ length: NUMBER_COUNT }, () => randInt(rng, NUMBER_MIN, NUMBER_MAX));
      const reachable = findReachableValues(numbers);
      inRangeCandidates = [...reachable].filter((v) => v >= TARGET_MIN && v <= TARGET_MAX);
    }

    const target =
      inRangeCandidates.length > 0
        ? inRangeCandidates[randInt(rng, 0, inRangeCandidates.length - 1)]!
        : numbers.reduce((a, b) => a + b, 0);

    return { numbers, target };
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
      return { numbers: content.numbers, target: content.target, pool: content.numbers, steps: [], complete: false };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      numbers: content.numbers,
      target: content.target,
      pool: result.pool,
      steps: result.steps,
      complete,
      won: complete ? result.won : undefined,
    };
  },
};
