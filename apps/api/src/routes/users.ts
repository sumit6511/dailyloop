import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { updateProfileSchema, type UserStatsDTO } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { toMeDTO, toPublicUserDTO } from "../lib/dto.js";
import { Errors } from "../lib/errors.js";
import { getRelationship } from "../services/friends.js";

const searchQuerySchema = z.object({ q: z.string().optional() });

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/me", { preHandler: app.requireAuth }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body);
    const updated = await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: body,
    });
    return reply.send({ data: toMeDTO(updated) });
  });

  app.get("/search", { preHandler: app.requireAuth }, async (request, reply) => {
    const { q } = searchQuerySchema.parse(request.query);
    const query = (q ?? "").trim();
    if (query.length < 2) return reply.send({ data: [] });

    const users = await prisma.user.findMany({
      where: {
        id: { not: request.currentUser!.id },
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { username: "asc" },
    });

    const data = await Promise.all(
      users.map(async (user) => ({
        ...toPublicUserDTO(user),
        relationship: await getRelationship(request.currentUser!.id, user.id),
      })),
    );
    return reply.send({ data });
  });

  app.get<{ Params: { username: string } }>("/:username", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { username: request.params.username },
      include: { streak: true },
    });
    if (!user) throw Errors.notFound("User not found");

    const [totalPointsAgg, gamesPlayed, gamesWon] = await Promise.all([
      prisma.dailyScore.aggregate({ where: { userId: user.id }, _sum: { totalScore: true } }),
      prisma.gameAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
      prisma.gameAttempt.count({ where: { userId: user.id, status: "COMPLETED", won: true } }),
    ]);

    const stats: UserStatsDTO = {
      currentStreak: user.streak?.currentStreak ?? 0,
      longestStreak: user.streak?.longestStreak ?? 0,
      totalPoints: totalPointsAgg._sum.totalScore ?? 0,
      gamesPlayed,
      gamesWon,
    };

    const relationship = request.currentUser ? await getRelationship(request.currentUser.id, user.id) : null;

    return reply.send({ data: { ...toPublicUserDTO(user), stats, relationship } });
  });

  app.get<{ Params: { username: string } }>("/:username/achievements", async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { username: request.params.username } });
    if (!user) throw Errors.notFound("User not found");

    const unlocked = await prisma.userAchievement.findMany({
      where: { userId: user.id },
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
