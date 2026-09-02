import { z } from "zod";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng } from "../../rng.js";
import { edgeKey, generatePathwayPuzzle, type Cell, type PathwayPuzzle } from "./generator.js";

export type PathwayContent = PathwayPuzzle;
export type PathwayMove = Cell;

export interface PathwayResult {
  path: Cell[];
  mistakes: number;
  won: boolean;
}

const GRID_SIZE = 5;
const CHECKPOINT_COUNT = 5;
const WALL_COUNT = 6;

const cellSchema = z.object({ row: z.number().int().min(0), col: z.number().int().min(0) });

function cellKey(cell: Cell): string {
  return `${cell.row}-${cell.col}`;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function highestCheckpointInPath(path: Cell[], checkpointByCell: Map<string, number>): number {
  let max = 0;
  for (const cell of path) {
    const n = checkpointByCell.get(cellKey(cell));
    if (n !== undefined && n > max) max = n;
  }
  return max;
}

/**
 * Re-derives the full path from scratch every time, exactly like every other game's replay —
 * the move log is the source of truth, never a persisted "current path". Pathway's validity is
 * fully self-contained from the puzzle's own checkpoints/walls; unlike Sudoku it never needs the
 * hidden solution to check whether a player's path is legal.
 *
 * Three gestures share the single {row,col} move shape, told apart purely by how the target
 * relates to the current path: extending onto an adjacent, unvisited, unwalled cell grows the
 * path; landing back on the second-to-last cell retreats one step (free, like Logic Puzzle's
 * Erase — it's a correction, not a mistake); landing back on the very first cell restarts the
 * whole path (also free). Anything structurally impossible (out of bounds, not adjacent, wrong
 * first move) is silently ignored with no penalty, matching Logic Puzzle's convention for
 * garbage input. A plausible-but-illegal forward step — crossing a wall, revisiting a cell, or
 * touching a checkpoint out of order — is where mistakes (and the scoring penalty) come from.
 */
function replay(content: PathwayContent, moves: PathwayMove[]): ValidationResult<PathwayResult> {
  const checkpointByCell = new Map<string, number>();
  content.checkpoints.forEach((cp, i) => checkpointByCell.set(cellKey(cp), i + 1));
  const maxCheckpointNumber = content.checkpoints.length;
  const wallSet = new Set<string>();
  for (const wall of content.walls) wallSet.add(edgeKey(wall.a, wall.b));
  const total = content.size * content.size;

  const path: Cell[] = [];
  const visited = new Set<string>();
  let mistakes = 0;

  for (const move of moves) {
    if (move.row < 0 || move.row >= content.size || move.col < 0 || move.col >= content.size) continue;
    const key = cellKey(move);

    if (path.length === 0) {
      if (checkpointByCell.get(key) !== 1) continue; // the path must start at checkpoint 1
      path.push(move);
      visited.add(key);
      continue;
    }

    const head = path[path.length - 1]!;
    if (sameCell(move, head)) continue; // duplicate drag-over of the same cell, no-op

    if (path.length >= 2 && sameCell(move, path[path.length - 2]!)) {
      const removed = path.pop()!;
      visited.delete(cellKey(removed));
      continue; // retreat one step
    }

    if (path.length > 1 && sameCell(move, path[0]!)) {
      for (let i = 1; i < path.length; i++) visited.delete(cellKey(path[i]!));
      path.length = 1;
      continue; // restart back to just the first cell
    }

    const isAdjacent = Math.abs(move.row - head.row) + Math.abs(move.col - head.col) === 1;
    if (!isAdjacent) continue; // structurally impossible — ignored, not a mistake

    if (wallSet.has(edgeKey(head, move))) {
      mistakes++;
      continue;
    }
    if (visited.has(key)) {
      mistakes++;
      continue;
    }

    const checkpointNumber = checkpointByCell.get(key);
    if (checkpointNumber !== undefined) {
      if (checkpointNumber !== highestCheckpointInPath(path, checkpointByCell) + 1) {
        mistakes++; // this checkpoint out of order
        continue;
      }
      if (checkpointNumber === maxCheckpointNumber && path.length + 1 !== total) {
        mistakes++; // the last checkpoint must be the final cell, not reached early
        continue;
      }
    }

    path.push(move);
    visited.add(key);
  }

  const complete = path.length === total;
  return { won: complete, complete, mistakes, result: { path, mistakes, won: complete } };
}

export const pathwayGame: DailyGameModule<PathwayContent, PathwayMove, PathwayResult> = {
  id: "pathway",
  name: "Pathway",
  description: "Draw one continuous path through every cell, in checkpoint order.",
  icon: "🧵",
  difficulty: "hard",

  contentSchema: z.object({
    size: z.number().int().min(3),
    checkpoints: z.array(cellSchema),
    walls: z.array(z.object({ a: cellSchema, b: cellSchema })),
    solution: z.array(cellSchema),
  }) as z.ZodType<PathwayContent>,

  moveSchema: cellSchema as z.ZodType<PathwayMove>,

  generatePuzzle(_seed, dateKey) {
    const rng = createRng(`pathway-${dateKey}`);
    return generatePathwayPuzzle(rng, GRID_SIZE, CHECKPOINT_COUNT, WALL_COUNT);
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
      speedBonus: speedBonus(meta.durationMs, 45_000, 360_000, 20),
    });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return { size: content.size, checkpoints: content.checkpoints, walls: content.walls, path: [], complete: false };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      size: content.size,
      checkpoints: content.checkpoints,
      walls: content.walls,
      path: result.path,
      complete,
      ...(complete ? { mistakes: result.mistakes, won: result.won } : {}),
    };
  },
};

export type { Cell };
