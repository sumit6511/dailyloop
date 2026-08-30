import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

export const achievementRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: app.requireAuth }, async (_request, reply) => {
    const achievements = await prisma.achievement.findMany({ orderBy: { key: "asc" } });
    return reply.send({ data: achievements });
  });
};
