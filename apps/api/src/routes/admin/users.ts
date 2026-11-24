import type { FastifyPluginAsync } from "fastify";
import { activeStreak, getTodayKey, jsDateToDateKey } from "@dailyloop/shared";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", async (_request, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { streak: true },
    });

    // Two grouped queries for every user's totals, instead of two queries per user.
    const [played, points] = await Promise.all([
      prisma.gameAttempt.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED" },
        _count: { _all: true },
      }),
      prisma.dailyScore.groupBy({ by: ["userId"], _sum: { totalScore: true } }),
    ]);
    const gamesPlayedBy = new Map(played.map((p) => [p.userId, p._count._all]));
    const pointsBy = new Map(points.map((p) => [p.userId, p._sum.totalScore ?? 0]));

    const today = getTodayKey(env.DEFAULT_TIMEZONE);
    const data = users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      currentStreak: activeStreak(
        user.streak?.currentStreak ?? 0,
        user.streak?.lastCompletedDate ? jsDateToDateKey(user.streak.lastCompletedDate) : null,
        today,
      ),
      gamesPlayed: gamesPlayedBy.get(user.id) ?? 0,
      totalPoints: pointsBy.get(user.id) ?? 0,
    }));

    return reply.send({ data });
  });
};
