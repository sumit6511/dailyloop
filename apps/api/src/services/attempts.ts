import { isDeepStrictEqual } from "node:util";
import { Prisma, type AttemptStatus, type GameAttempt } from "@prisma/client";
import { ACTIVE_TIME } from "@dailyloop/shared";
import { getGameModule } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { AttemptConflictError, completeAttempt } from "./complete-attempt.js";
import { findTodaysPuzzle } from "./puzzle-lookup.js";

function movesOf(attemptLog: Prisma.JsonValue | null): unknown[] {
  return Array.isArray(attemptLog) ? attemptLog : [];
}

/**
 * Every write to an attempt is a compare-and-set on `version`: read, compute, then update only
 * if nobody else wrote in between. A writer that loses re-reads and recomputes from the fresh
 * row — correct here because moves only ever append, so a concurrent move is simply replayed
 * first. Each round lets at least one writer through, so a handful of retries covers any burst
 * of requests a single player can produce.
 */
const MAX_WRITE_ATTEMPTS = 10;

function loadAttempt(userId: string, dailyPuzzleId: string) {
  return prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId } },
  });
}

/** Applies `data` only if the attempt is still in progress at the version we read. */
async function compareAndSet(
  attempt: GameAttempt,
  data: Prisma.GameAttemptUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await prisma.gameAttempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS", version: attempt.version },
    data: { ...data, version: { increment: 1 } },
  });
  return count === 1;
}

/**
 * Active-time bookkeeping for one more piece of activity at `now`: the gap since the previous
 * activity counts as play only if it's short enough that the player was plausibly still on the
 * puzzle (ACTIVE_TIME.MAX_GAP_MS); anything longer is treated as time away. Folded into every
 * attempt write, so it shares their compare-and-set and can't lose an increment.
 */
export function activity(attempt: Pick<GameAttempt, "activeMs" | "lastActiveAt">, now: Date) {
  const gap = attempt.lastActiveAt ? now.getTime() - attempt.lastActiveAt.getTime() : Infinity;
  const credited = gap >= 0 && gap <= ACTIVE_TIME.MAX_GAP_MS ? gap : 0;
  return { activeMs: attempt.activeMs + credited, lastActiveAt: now };
}

class TooMuchContentionError extends Error {
  constructor() {
    super("Couldn't update the attempt after repeated concurrent writes");
  }
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

  let attempt = await loadAttempt(userId, puzzle.id);
  if (!attempt) {
    try {
      attempt = await prisma.gameAttempt.create({
        data: {
          userId,
          dailyPuzzleId: puzzle.id,
          status: "IN_PROGRESS",
          attemptLog: [],
          lastActiveAt: new Date(),
        },
      });
    } catch (err) {
      // Two starts raced (e.g. a double-mounted page) and the other one created the row first.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      attempt = (await loadAttempt(userId, puzzle.id))!;
    }
  }

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

/**
 * Asks a game for its next-step suggestion and charges the attempt for it. Never touches the
 * move log, but a hint is not free: `hintsUsed` feeds into scoring. Charging is per *distinct*
 * hint — asking again for exactly the suggestion last paid for (e.g. after dismissing it) costs
 * nothing — and the charge is a compare-and-set like every attempt write, so two simultaneous
 * requests can neither double-charge nor both slip through uncharged.
 */
export async function getHint(userId: string, gameSlug: string): Promise<HintResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };
  if (!module.hint) return { kind: "not_supported" };

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
  if (!puzzle) return { kind: "not_available" };

  for (let tries = 0; tries < MAX_WRITE_ATTEMPTS; tries++) {
    const attempt = await loadAttempt(userId, puzzle.id);
    if (!attempt) return { kind: "not_started" };
    if (attempt.status === "COMPLETED") return { kind: "already_completed" };

    const suggestion = module.hint(puzzle.content, movesOf(attempt.attemptLog));
    if (suggestion === null || suggestion === undefined) {
      return { kind: "ok", hint: null, hintsUsed: attempt.hintsUsed }; // nothing revealed, nothing charged
    }
    // Normalise through JSON so it compares equal to what comes back out of the jsonb column.
    const hint = JSON.parse(JSON.stringify(suggestion)) as Prisma.InputJsonValue;
    if (isDeepStrictEqual(attempt.lastHint, hint))
      return { kind: "ok", hint, hintsUsed: attempt.hintsUsed };

    const charge = {
      hintsUsed: { increment: 1 },
      lastHint: hint,
      ...activity(attempt, new Date()),
    };
    if (await compareAndSet(attempt, charge)) {
      return { kind: "ok", hint, hintsUsed: attempt.hintsUsed + 1 };
    }
    // Lost a race with another hint or a move — re-read and decide again.
  }
  throw new TooMuchContentionError();
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

  for (let tries = 0; tries < MAX_WRITE_ATTEMPTS; tries++) {
    const attempt = await loadAttempt(userId, puzzle.id);
    if (!attempt) return { kind: "not_started" };
    if (attempt.status === "COMPLETED") return { kind: "already_completed" };

    const moves = movesOf(attempt.attemptLog);
    if (moves.length === 0) return { kind: "nothing_to_undo" };

    const newMoves = moves.slice(0, -1);
    const validation = module.validateAttempt(puzzle.content, newMoves);
    const written = await compareAndSet(attempt, {
      attemptLog: newMoves as Prisma.InputJsonValue,
      mistakeCount: validation.mistakes,
      ...activity(attempt, new Date()),
    });
    if (written) {
      return {
        kind: "ok",
        content: module.sanitizeForClient(puzzle.content, {
          status: "IN_PROGRESS",
          moves: newMoves,
        }),
      };
    }
  }
  throw new TooMuchContentionError();
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

export async function submitMove(
  userId: string,
  gameSlug: string,
  rawMove: unknown,
): Promise<SubmitMoveResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
  if (!puzzle) return { kind: "not_available" };

  const parsedMove = module.moveSchema.safeParse(rawMove);

  for (let tries = 0; tries < MAX_WRITE_ATTEMPTS; tries++) {
    const attempt = await loadAttempt(userId, puzzle.id);
    if (!attempt) return { kind: "not_started" };

    if (attempt.status === "COMPLETED") {
      const moves = movesOf(attempt.attemptLog);
      return {
        kind: "already_completed",
        content: module.sanitizeForClient(puzzle.content, { status: "COMPLETED", moves }),
      };
    }

    if (!parsedMove.success) return { kind: "invalid_move", details: parsedMove.error.flatten() };

    const moves = [...movesOf(attempt.attemptLog), parsedMove.data];
    const validation = module.validateAttempt(puzzle.content, moves);
    const now = new Date();
    const active = activity(attempt, now);

    if (!validation.complete) {
      const written = await compareAndSet(attempt, {
        attemptLog: moves as Prisma.InputJsonValue,
        mistakeCount: validation.mistakes,
        ...active,
      });
      if (!written) continue;
      return {
        kind: "ok",
        complete: false,
        won: false,
        content: module.sanitizeForClient(puzzle.content, { status: "IN_PROGRESS", moves }),
        score: null,
        newlyUnlockedAchievements: [],
      };
    }

    const durationMs =
      module.timing === "active" ? active.activeMs : now.getTime() - attempt.startedAt.getTime();
    const scoreBreakdown = module.calculateScore(puzzle.content, validation.result, {
      durationMs,
      hintsUsed: attempt.hintsUsed,
    });

    let newlyUnlockedAchievements: string[];
    try {
      ({ newlyUnlockedAchievements } = await completeAttempt({
        userId,
        dailyPuzzleId: puzzle.id,
        expectedVersion: attempt.version,
        activeMs: active.activeMs,
        won: validation.won,
        mistakeCount: validation.mistakes,
        durationMs,
        moves,
        scoreBreakdown,
      }));
    } catch (err) {
      if (err instanceof AttemptConflictError) continue; // someone else wrote first — replay on top
      throw err;
    }

    return {
      kind: "ok",
      complete: true,
      won: validation.won,
      content: module.sanitizeForClient(puzzle.content, { status: "COMPLETED", moves }),
      score: scoreBreakdown.total,
      newlyUnlockedAchievements,
    };
  }
  throw new TooMuchContentionError();
}

export type HeartbeatResult =
  | { kind: "no_module_or_game" }
  | { kind: "not_available" }
  | { kind: "not_started" }
  | { kind: "ok"; activeMs: number; complete: boolean };

/**
 * "The player is still on this puzzle." Sent periodically by pages that show a pausable timer;
 * credits the time since the last activity (if short enough) and returns the running total, so
 * the page can display exactly the time that will be scored. Harmless for any game: it only
 * changes the scored duration of modules with `timing: "active"`.
 */
export async function recordHeartbeat(userId: string, gameSlug: string): Promise<HeartbeatResult> {
  const module = getGameModule(gameSlug);
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!module || !game || !game.isEnabled) return { kind: "no_module_or_game" };

  const puzzle = await findTodaysPuzzle(game.id, game.slug);
  if (!puzzle) return { kind: "not_available" };

  for (let tries = 0; tries < MAX_WRITE_ATTEMPTS; tries++) {
    const attempt = await loadAttempt(userId, puzzle.id);
    if (!attempt) return { kind: "not_started" };
    if (attempt.status === "COMPLETED")
      return { kind: "ok", activeMs: attempt.activeMs, complete: true };

    const active = activity(attempt, new Date());
    if (await compareAndSet(attempt, active))
      return { kind: "ok", activeMs: active.activeMs, complete: false };
  }
  throw new TooMuchContentionError();
}
