import { z } from "zod";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng } from "../../rng.js";
import { SIZE, generateSolvedGrid, carvePuzzle, isValidPlacement, isValidCompleteGrid, findHint, type Grid } from "./sudoku.js";

export interface LogicPuzzleContent {
  /** Server-only — never sent to the client except via the read-only hint endpoint's fallback. */
  solution: Grid;
  /** 0 = blank — the given clues, safe to send to the client immediately. */
  puzzle: Grid;
}

export interface LogicPuzzleMove {
  row: number;
  col: number;
  /** 0 clears the cell. */
  value: number;
}

export interface LogicPuzzleResult {
  grid: Grid;
  mistakes: number;
  won: boolean;
}

const MAX_REMOVALS = 16;

/**
 * A non-zero move is only ever committed if it doesn't duplicate a value already in its row,
 * column, or box — checked against the *current* grid, never the hidden solution. A rejected
 * move counts as a mistake and leaves the grid untouched, so a cell is never visibly wrong: it's
 * either correct, blank, or (transiently, client-side) a rejected attempt that never landed.
 * Since the puzzle's solution is guaranteed unique at generation time, a full grid that satisfies
 * every constraint is necessarily *the* solution — so win detection never needs to compare
 * against it either.
 */
function replay(content: LogicPuzzleContent, moves: LogicPuzzleMove[]): ValidationResult<LogicPuzzleResult> {
  const grid = content.puzzle.map((row) => [...row]);
  let mistakes = 0;

  for (const move of moves) {
    if (move.row < 0 || move.row >= SIZE || move.col < 0 || move.col >= SIZE) continue;
    if (content.puzzle[move.row]![move.col] !== 0) continue; // can't overwrite a given clue
    if (move.value < 0 || move.value > SIZE) continue;

    if (move.value === 0) {
      grid[move.row]![move.col] = 0; // erase always succeeds, never a mistake
      continue;
    }

    const previous = grid[move.row]![move.col]!;
    grid[move.row]![move.col] = 0; // isValidPlacement assumes the target cell is empty
    if (isValidPlacement(grid, move.row, move.col, move.value)) {
      grid[move.row]![move.col] = move.value;
    } else {
      grid[move.row]![move.col] = previous; // rejected — restore whatever was there before
      mistakes++;
    }
  }

  const won = isValidCompleteGrid(grid);
  return { won, complete: won, mistakes, result: { grid, mistakes, won } };
}

export const logicPuzzleGame: DailyGameModule<LogicPuzzleContent, LogicPuzzleMove, LogicPuzzleResult> = {
  id: "logic-puzzle",
  name: "Logic Puzzle",
  description: "Solve a daily 6×6 mini logic grid.",
  icon: "🧠",
  difficulty: "hard",

  contentSchema: z.object({
    solution: z.array(z.array(z.number().int().min(1).max(SIZE)).length(SIZE)).length(SIZE),
    puzzle: z.array(z.array(z.number().int().min(0).max(SIZE)).length(SIZE)).length(SIZE),
  }),

  moveSchema: z.object({
    row: z.number().int().min(0).max(SIZE - 1),
    col: z.number().int().min(0).max(SIZE - 1),
    value: z.number().int().min(0).max(SIZE),
  }),

  generatePuzzle(_seed, dateKey) {
    const rng = createRng(`logic-puzzle-${dateKey}`);
    const solution = generateSolvedGrid(rng);
    const puzzle = carvePuzzle(solution, rng, MAX_REMOVALS);
    return { solution, puzzle };
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) return buildScoreBreakdown({ base: 0 });
    return buildScoreBreakdown({
      base: 60,
      accuracyBonus: result.mistakes === 0 ? 20 : 0,
      mistakePenalty: result.mistakes * 8,
      speedBonus: speedBonus(meta.durationMs, 60_000, 480_000, 20),
    });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return { puzzle: content.puzzle, grid: content.puzzle, complete: false };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      puzzle: content.puzzle,
      grid: result.grid,
      complete,
      ...(complete ? { mistakes: result.mistakes, won: result.won } : {}),
    };
  },

  /** Read-only — never touches the move log. Every committed cell is already guaranteed legal
   * under the constraint-rejection model above, so `findHint` can deduce purely from the current
   * grid; `content.solution` is only a defensive fallback (see sudoku.ts). */
  hint(content, moves) {
    const { result } = replay(content, moves);
    return findHint(result.grid, content.solution);
  },
};
