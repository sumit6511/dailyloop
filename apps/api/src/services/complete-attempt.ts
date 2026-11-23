import type { Prisma } from "@prisma/client";
import { isConsecutiveDay, jsDateToDateKey } from "@dailyloop/shared";
import type { ScoreBreakdown } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements } from "./achievements.js";
import { recomputeDailyScore } from "./daily-score.js";

/** The attempt changed (or was already completed) since the caller read it — nothing was written. */
export class AttemptConflictError extends Error {
  constructor() {
    super("The attempt was modified concurrently");
  }
}

interface CompleteAttemptInput {
  userId: string;
  dailyPuzzleId: string;
  /** The `version` the caller computed the result from; completion only happens if it's unchanged. */
  expectedVersion: number;
  /** Active play time up to and including this final move. */
  activeMs: number;
  won: boolean;
  mistakeCount: number;
  durationMs: number;
  moves: unknown[];
  scoreBreakdown: ScoreBreakdown;
}

/**
 * Finalizes a completed attempt: records the server-computed score, recomputes that day's
 * DailyScore from scratch (never incrementally — a from-scratch sum can't drift), and advances
 * the streak if this was the user's first completed game of the day. All in one transaction so
 * a crash mid-way can't leave the attempt scored but the streak/DailyScore stale.
 */
export async function completeAttempt(input: CompleteAttemptInput) {
  return prisma.$transaction(async (tx) => {
    const puzzle = await tx.dailyPuzzle.findUniqueOrThrow({ where: { id: input.dailyPuzzleId } });
    const dateKey = jsDateToDateKey(puzzle.date);

    // Compare-and-set inside the transaction: if another request already moved or completed this
    // attempt, write nothing and let the caller re-read. Without this, two racing final moves would
    // both run the streak logic below, and the second would reset the streak to 1.
    const { count } = await tx.gameAttempt.updateMany({
      where: {
        userId: input.userId,
        dailyPuzzleId: input.dailyPuzzleId,
        status: "IN_PROGRESS",
        version: input.expectedVersion,
      },
      data: {
        version: { increment: 1 },
        activeMs: input.activeMs,
        lastActiveAt: new Date(),
        status: "COMPLETED",
        attemptLog: input.moves as Prisma.InputJsonValue,
        mistakeCount: input.mistakeCount,
        durationMs: input.durationMs,
        won: input.won,
        score: input.scoreBreakdown.total,
        scoreBreakdown: input.scoreBreakdown as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    if (count !== 1) throw new AttemptConflictError();
    const attempt = await tx.gameAttempt.findUniqueOrThrow({
      where: { userId_dailyPuzzleId: { userId: input.userId, dailyPuzzleId: input.dailyPuzzleId } },
    });

    const dailyScore = (await recomputeDailyScore(tx, input.userId, puzzle.date))!;
    const { gamesCompleted, isPerfectDay } = dailyScore;

    // The streak only advances once per day, on that day's first completed game.
    let streak = await tx.streak.findUnique({ where: { userId: input.userId } });
    if (gamesCompleted === 1) {
      const previousKey = streak?.lastCompletedDate ? jsDateToDateKey(streak.lastCompletedDate) : null;
      const currentStreak = isConsecutiveDay(previousKey, dateKey) ? (streak?.currentStreak ?? 0) + 1 : 1;
      const longestStreak = Math.max(streak?.longestStreak ?? 0, currentStreak);
      streak = await tx.streak.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, currentStreak, longestStreak, lastCompletedDate: puzzle.date },
        update: { currentStreak, longestStreak, lastCompletedDate: puzzle.date },
      });
    }

    const newlyUnlockedAchievements = await evaluateAchievements(tx, input.userId, {
      won: input.won,
      currentStreak: streak?.currentStreak ?? 0,
      isPerfectDay,
      durationMs: input.durationMs,
      mistakeCount: input.mistakeCount,
      hintsUsed: attempt.hintsUsed,
    });

    return { attempt, dailyScore, streak, newlyUnlockedAchievements };
  });
}
