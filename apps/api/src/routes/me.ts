import type { FastifyPluginAsync } from "fastify";
import { activeStreak, getTodayKey, jsDateToDateKey, type MyStatsDTO } from "@dailyloop/shared";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/streak", { preHandler: app.requireAuth }, async (request, reply) => {
    const streak = await prisma.streak.findUnique({ where: { userId: request.currentUser!.id } });
    return reply.send({
      data: {
        currentStreak: activeStreak(
          streak?.currentStreak ?? 0,
          streak?.lastCompletedDate ? jsDateToDateKey(streak.lastCompletedDate) : null,
          getTodayKey(env.DEFAULT_TIMEZONE),
        ),
        longestStreak: streak?.longestStreak ?? 0,
        lastCompletedDate: streak?.lastCompletedDate
          ? jsDateToDateKey(streak.lastCompletedDate)
          : null,
      },
    });
  });

  /** Per-game history for the signed-in player, plus Word Guess's guess distribution. */
  app.get("/stats", { preHandler: app.requireAuth }, async (request, reply) => {
    const userId = request.currentUser!.id;
    const [games, attempts] = await Promise.all([
      prisma.game.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
      prisma.gameAttempt.findMany({
        where: { userId, status: "COMPLETED" },
        select: {
          won: true,
          score: true,
          attemptLog: true,
          dailyPuzzle: { select: { gameId: true } },
        },
      }),
    ]);

    const data: MyStatsDTO = {
      games: games.map((game) => {
        const mine = attempts.filter((a) => a.dailyPuzzle.gameId === game.id);
        const won = mine.filter((a) => a.won).length;
        return {
          slug: game.slug,
          name: game.name,
          icon: game.icon,
          played: mine.length,
          won,
          winRate: mine.length ? Math.round((won / mine.length) * 100) : 0,
          averageScore: mine.length
            ? Math.round(mine.reduce((sum, a) => sum + a.score, 0) / mine.length)
            : 0,
          bestScore: mine.reduce((best, a) => Math.max(best, a.score), 0),
        };
      }),
      wordGuessDistribution: [0, 0, 0, 0, 0, 0],
    };

    // A won Word Guess attempt's log is exactly its guesses (invalid words never reach the log).
    const wordGuess = games.find((g) => g.slug === "word-guess");
    for (const attempt of attempts) {
      if (!wordGuess || attempt.dailyPuzzle.gameId !== wordGuess.id || !attempt.won) continue;
      const guesses = Array.isArray(attempt.attemptLog) ? attempt.attemptLog.length : 0;
      if (guesses >= 1 && guesses <= 6) data.wordGuessDistribution[guesses - 1]!++;
    }

    return reply.send({ data });
  });

  app.get("/achievements", { preHandler: app.requireAuth }, async (request, reply) => {
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId: request.currentUser!.id },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
    });
    return reply.send({
      data: unlocked.map((u) => ({
        key: u.achievement.key,
        name: u.achievement.name,
        description: u.achievement.description,
        icon: u.achievement.icon,
        unlockedAt: u.unlockedAt,
      })),
    });
  });
};
