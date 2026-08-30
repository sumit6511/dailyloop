import type { Prisma } from "@prisma/client";
import { SCORE } from "@dailyloop/shared";
import { isConsecutiveDay, jsDateToDateKey } from "@dailyloop/shared";
import type { ScoreBreakdown } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements } from "./achievements.js";

interface CompleteAttemptInput {
  userId: string;
  dailyPuzzleId: string;
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

    const attempt = await tx.gameAttempt.update({
      where: { userId_dailyPuzzleId: { userId: input.userId, dailyPuzzleId: input.dailyPuzzleId } },
      data: {
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

    const completedAttemptsToday = await tx.gameAttempt.findMany({
      where: { userId: input.userId, status: "COMPLETED", dailyPuzzle: { date: puzzle.date } },
      select: { score: true },
    });
    const publishedGamesToday = await tx.dailyPuzzle.count({ where: { date: puzzle.date, status: "PUBLISHED" } });
    const gamesCompleted = completedAttemptsToday.length;
    const isPerfectDay = publishedGamesToday > 0 && gamesCompleted >= publishedGamesToday;
    const rawTotal = completedAttemptsToday.reduce((sum, a) => sum + a.score, 0);
    const totalScore = rawTotal + (isPerfectDay ? SCORE.PERFECT_DAY_BONUS : 0);

    const dailyScore = await tx.dailyScore.upsert({
      where: { userId_date: { userId: input.userId, date: puzzle.date } },
      create: { userId: input.userId, date: puzzle.date, totalScore, gamesCompleted, isPerfectDay },
      update: { totalScore, gamesCompleted, isPerfectDay },
    });

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
    });

    return { attempt, dailyScore, streak, newlyUnlockedAchievements };
  });
}
