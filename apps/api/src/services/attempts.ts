import { isDeepStrictEqual } from "node:util";
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

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
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

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
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
  | { kind: "already_completed" }
  | { kind: "ok"; hint: unknown; hintsUsed: number };

const MAX_HINT_CHARGE_ATTEMPTS = 5;

/**
 * Asks a game for its next-step suggestion and charges the attempt for it. Never touches the
 * move log, but a hint is not free: `hintsUsed` feeds into scoring. Charging is per *distinct*
 * hint — asking again for exactly the suggestion last paid for (e.g. after dismissing it) costs
 * nothing — and is a compare-and-set on the current count, so two simultaneous requests can
 * neither double-charge nor both slip through uncharged.
 */
export async function getHint(userId: string, gameSlug: string): Promise<HintResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };
  if (!module.hint) return { kind: "not_supported" };

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
  if (!puzzle) return { kind: "not_available" };

  for (let tries = 0; tries < MAX_HINT_CHARGE_ATTEMPTS; tries++) {
    const attempt = await prisma.gameAttempt.findUnique({
      where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
    });
    if (!attempt) return { kind: "not_started" };
    if (attempt.status === "COMPLETED") return { kind: "already_completed" };

    const suggestion = module.hint(puzzle.content, movesOf(attempt.attemptLog));
    if (suggestion === null || suggestion === undefined) {
      return { kind: "ok", hint: null, hintsUsed: attempt.hintsUsed }; // nothing revealed, nothing charged
    }
    // Normalise through JSON so it compares equal to what comes back out of the jsonb column.
    const hint = JSON.parse(JSON.stringify(suggestion)) as Prisma.InputJsonValue;
    if (isDeepStrictEqual(attempt.lastHint, hint)) return { kind: "ok", hint, hintsUsed: attempt.hintsUsed };

    const { count } = await prisma.gameAttempt.updateMany({
      where: { id: attempt.id, status: "IN_PROGRESS", hintsUsed: attempt.hintsUsed },
      data: { hintsUsed: { increment: 1 }, lastHint: hint },
    });
    if (count === 1) return { kind: "ok", hint, hintsUsed: attempt.hintsUsed + 1 };
    // Lost a race with another hint or the final move — re-read and decide again.
  }
  throw new Error("Couldn't record a hint after repeated concurrent updates");
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

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
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

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
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
  const scoreBreakdown = module.calculateScore(puzzle.content, validation.result, {
    durationMs,
    hintsUsed: attempt.hintsUsed,
  });

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
