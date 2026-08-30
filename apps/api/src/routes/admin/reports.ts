import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getTodayKey, dateKeyToJSDate } from "@dailyloop/shared";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const adminReportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats/overview", async (_request, reply) => {
    const [totalUsers, totalAttempts, completedAttempts, games] = await Promise.all([
      prisma.user.count(),
      prisma.gameAttempt.count(),
      prisma.gameAttempt.count({ where: { status: "COMPLETED" } }),
      prisma.game.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { puzzles: true } } } }),
    ]);

    const perGame = await Promise.all(
      games.map(async (game) => {
        const [completedCount, avgScoreAgg] = await Promise.all([
          prisma.gameAttempt.count({ where: { status: "COMPLETED", dailyPuzzle: { gameId: game.id } } }),
          prisma.gameAttempt.aggregate({
            where: { status: "COMPLETED", dailyPuzzle: { gameId: game.id } },
            _avg: { score: true },
          }),
        ]);
        return {
          slug: game.slug,
          name: game.name,
          isEnabled: game.isEnabled,
          puzzleCount: game._count.puzzles,
          completedCount,
          averageScore: Math.round(avgScoreAgg._avg.score ?? 0),
        };
      }),
    );

    return reply.send({ data: { totalUsers, totalAttempts, completedAttempts, games: perGame } });
  });

  app.get("/activity", async (request, reply) => {
    const query = dateQuerySchema.parse(request.query);
    const dateKey = query.date ?? getTodayKey(env.DEFAULT_TIMEZONE);
    const date = dateKeyToJSDate(dateKey);

    const [scores, attempts] = await Promise.all([
      prisma.dailyScore.findMany({ where: { date }, include: { user: true }, orderBy: { totalScore: "desc" } }),
      prisma.gameAttempt.findMany({ where: { dailyPuzzle: { date } } }),
    ]);

    return reply.send({
      data: {
        date: dateKey,
        activeUsers: scores.length,
        perfectDays: scores.filter((s) => s.isPerfectDay).length,
        totalAttempts: attempts.length,
        completedAttempts: attempts.filter((a) => a.status === "COMPLETED").length,
        topScores: scores
          .slice(0, 10)
          .map((s) => ({ username: s.user.username, score: s.totalScore, isPerfectDay: s.isPerfectDay })),
      },
    });
  });
};
