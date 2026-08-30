import type { FastifyPluginAsync } from "fastify";
import { jsDateToDateKey } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/streak", { preHandler: app.requireAuth }, async (request, reply) => {
    const streak = await prisma.streak.findUnique({ where: { userId: request.currentUser!.id } });
    return reply.send({
      data: {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        lastCompletedDate: streak?.lastCompletedDate ? jsDateToDateKey(streak.lastCompletedDate) : null,
      },
    });
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
