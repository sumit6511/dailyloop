import type { Prisma, AttemptStatus } from "@prisma/client";
import { getGameModule } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { completeAttempt } from "./complete-attempt.js";
import { findTodaysPuzzle } from "./puzzle-lookup.js";

function movesOf(attemptLog: Prisma.JsonValue | null): unknown[] {
  return Array.isArray(attemptLog) ? attemptLog : [];
}

export type StartAttemptResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "ok"; content: unknown; status: AttemptStatus };

export async function startAttempt(userId: string, gameSlug: string): Promise<StartAttemptResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };

  const puzzle = await findTodaysPuzzle(game.id);
  if (!puzzle) return { kind: "not_available" };

  let attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });
  attempt ??= await prisma.gameAttempt.create({
    data: { userId, dailyPuzzleId: puzzle.id, status: "IN_PROGRESS", attemptLog: [] },
  });

  const moves = movesOf(attempt.attemptLog);
  const content = module.sanitizeForClient(puzzle.content, { status: attempt.status, moves });
  return { kind: "ok", content, status: attempt.status };
}

export type CheckAttemptResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "not_started" }
  | { kind: "not_supported" }
  | { kind: "ok"; result: unknown };

/** Read-only — asks a game "is what's filled in so far correct?" without recording a move. */
export async function checkAttempt(userId: string, gameSlug: string): Promise<CheckAttemptResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };
  if (!module.checkProgress) return { kind: "not_supported" };

  const puzzle = await findTodaysPuzzle(game.id);
  if (!puzzle) return { kind: "not_available" };

  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });
  if (!attempt) return { kind: "not_started" };

  const moves = movesOf(attempt.attemptLog);
  return { kind: "ok", result: module.checkProgress(puzzle.content, moves) };
}

export type HintResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "not_started" }
  | { kind: "not_supported" }
  | { kind: "ok"; suggestion: unknown };

/** Read-only — asks a game "what's a legal next move?" without recording anything. */
export async function getHint(userId: string, gameSlug: string): Promise<HintResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };
  if (!module.hint) return { kind: "not_supported" };

  const puzzle = await findTodaysPuzzle(game.id);
  if (!puzzle) return { kind: "not_available" };

  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });
  if (!attempt) return { kind: "not_started" };

  const moves = movesOf(attempt.attemptLog);
  return { kind: "ok", suggestion: module.hint(puzzle.content, moves) };
}

export type UndoMoveResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "not_started" }
  | { kind: "already_completed" }
  | { kind: "nothing_to_undo" }
  | { kind: "ok"; content: unknown };

/**
 * Drops the last move from the attempt log and re-derives state — generic (any game could use
 * it), but the route only enables it for games where undoing doesn't let a player erase a
 * genuine mistake's scoring impact (e.g. Number Puzzle, where undo reverses a strategic combine
 * rather than un-losing a Connections guess or un-spending a Word Guess try).
 */
export async function undoLastMove(userId: string, gameSlug: string): Promise<UndoMoveResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };

  const puzzle = await findTodaysPuzzle(game.id);
  if (!puzzle) return { kind: "not_available" };

  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });
  if (!attempt) return { kind: "not_started" };
  if (attempt.status === "COMPLETED") return { kind: "already_completed" };

  const moves = movesOf(attempt.attemptLog);
  if (moves.length === 0) return { kind: "nothing_to_undo" };

  const newMoves = moves.slice(0, -1);
  const validation = module.validateAttempt(puzzle.content, newMoves);
  await prisma.gameAttempt.update({
    where: { id: attempt.id },
    data: { attemptLog: newMoves as Prisma.InputJsonValue, mistakeCount: validation.mistakes },
  });

  return { kind: "ok", content: module.sanitizeForClient(puzzle.content, { status: "IN_PROGRESS", moves: newMoves }) };
}

export type SubmitMoveResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "not_started" }
  | { kind: "already_completed"; content: unknown }
  | { kind: "invalid_move"; details: unknown }
  | {
      kind: "ok";
      complete: boolean;
      won: boolean;
      content: unknown;
      score: number | null;
      newlyUnlockedAchievements: string[];
    };

export async function submitMove(userId: string, gameSlug: string, rawMove: unknown): Promise<SubmitMoveResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };

  const puzzle = await findTodaysPuzzle(game.id);
  if (!puzzle) return { kind: "not_available" };

  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });
  if (!attempt) return { kind: "not_started" };

  if (attempt.status === "COMPLETED") {
    const moves = movesOf(attempt.attemptLog);
    return {
      kind: "already_completed",
      content: module.sanitizeForClient(puzzle.content, { status: "COMPLETED", moves }),
    };
  }

  const parsedMove = module.moveSchema.safeParse(rawMove);
  if (!parsedMove.success) return { kind: "invalid_move", details: parsedMove.error.flatten() };

  const moves = [...movesOf(attempt.attemptLog), parsedMove.data];
  const validation = module.validateAttempt(puzzle.content, moves);

  if (!validation.complete) {
    await prisma.gameAttempt.update({
      where: { id: attempt.id },
      data: { attemptLog: moves as Prisma.InputJsonValue, mistakeCount: validation.mistakes },
    });
    return {
      kind: "ok",
      complete: false,
      won: false,
      content: module.sanitizeForClient(puzzle.content, { status: "IN_PROGRESS", moves }),
      score: null,
      newlyUnlockedAchievements: [],
    };
  }

  const durationMs = Date.now() - attempt.startedAt.getTime();
  const scoreBreakdown = module.calculateScore(puzzle.content, validation.result, { durationMs });

  const { newlyUnlockedAchievements } = await completeAttempt({
    userId,
    dailyPuzzleId: puzzle.id,
    won: validation.won,
    mistakeCount: validation.mistakes,
    durationMs,
    moves,
    scoreBreakdown,
  });

  return {
    kind: "ok",
    complete: true,
    won: validation.won,
    content: module.sanitizeForClient(puzzle.content, { status: "COMPLETED", moves }),
    score: scoreBreakdown.total,
    newlyUnlockedAchievements,
  };
}
