import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", async (_request, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { streak: true },
    });

    const data = await Promise.all(
      users.map(async (user) => {
        const [gamesPlayed, totalPointsAgg] = await Promise.all([
          prisma.gameAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
          prisma.dailyScore.aggregate({ where: { userId: user.id }, _sum: { totalScore: true } }),
        ]);
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          currentStreak: user.streak?.currentStreak ?? 0,
          gamesPlayed,
          totalPoints: totalPointsAgg._sum.totalScore ?? 0,
        };
      }),
    );

    return reply.send({ data });
  });
};
