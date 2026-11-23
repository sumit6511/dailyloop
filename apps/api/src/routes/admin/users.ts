import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", async (_request, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { streak: true },
    });

    // Two grouped queries for every user's totals, instead of two queries per user.
    const [played, points] = await Promise.all([
      prisma.gameAttempt.groupBy({ by: ["userId"], where: { status: "COMPLETED" }, _count: { _all: true } }),
      prisma.dailyScore.groupBy({ by: ["userId"], _sum: { totalScore: true } }),
    ]);
    const gamesPlayedBy = new Map(played.map((p) => [p.userId, p._count._all]));
    const pointsBy = new Map(points.map((p) => [p.userId, p._sum.totalScore ?? 0]));

    const data = users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      currentStreak: user.streak?.currentStreak ?? 0,
      gamesPlayed: gamesPlayedBy.get(user.id) ?? 0,
      totalPoints: pointsBy.get(user.id) ?? 0,
    }));

    return reply.send({ data });
  });
};
