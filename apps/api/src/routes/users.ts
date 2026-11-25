import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  SESSION_COOKIE_NAME,
  type UserStatsDTO,
  activeStreak,
  getTodayKey,
  jsDateToDateKey,
  addDaysToKey,
  dateKeyToJSDate,
  ACTIVITY_DAYS,
  type ActivityDTO,
  type ActivityDayDTO,
} from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { toMeDTO, toPublicUserDTO } from "../lib/dto.js";
import { Errors } from "../lib/errors.js";
import { getRelationship, getRelationships } from "../services/friends.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

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

  app.patch("/me/password", { preHandler: app.requireAuth }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);
    const user = request.currentUser!;

    const valid = await verifyPassword(user.passwordHash, body.currentPassword);
    if (!valid) throw Errors.badRequest("Current password is incorrect");

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      // A reset link requested before the change shouldn't still be able to override it.
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);

    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.send({ data: { ok: true } });
  });

  /**
   * Permanently deletes the signed-in account. Every personal row (sessions, attempts, scores,
   * streak, achievements, friendships, friend requests, reset links) cascades with it; puzzles an
   * admin created stay, unattributed. Needs the current password, and refuses to remove the last
   * admin, which would lock everyone out of the admin panel.
   */
  app.delete("/me", { preHandler: app.requireAuth }, async (request, reply) => {
    const { password } = deleteAccountSchema.parse(request.body);
    const user = request.currentUser!;
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw Errors.badRequest("Password is incorrect");
    }
    if (user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
      throw Errors.conflict(
        "You're the only admin. Make another account an admin before deleting this one.",
      );
    }
    await prisma.user.delete({ where: { id: user.id } });
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.send({ data: { ok: true } });
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

    const relationships = await getRelationships(
      request.currentUser!.id,
      users.map((u) => u.id),
    );
    const data = users.map((user) => ({
      ...toPublicUserDTO(user),
      relationship: relationships.get(user.id)!,
    }));
    return reply.send({ data });
  });

  // Profiles and achievements are for signed-in players, like everything else player-facing (the
  // web app's /u/:username is behind login too); anonymous callers could otherwise scrape them.
  app.get<{ Params: { username: string } }>(
    "/:username",
    { preHandler: app.requireAuth },
    async (request, reply) => {
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
        currentStreak: activeStreak(
          user.streak?.currentStreak ?? 0,
          user.streak?.lastCompletedDate ? jsDateToDateKey(user.streak.lastCompletedDate) : null,
          getTodayKey(env.DEFAULT_TIMEZONE),
        ),
        longestStreak: user.streak?.longestStreak ?? 0,
        totalPoints: totalPointsAgg._sum.totalScore ?? 0,
        gamesPlayed,
        gamesWon,
      };

      const relationship = await getRelationship(request.currentUser!.id, user.id);

      return reply.send({ data: { ...toPublicUserDTO(user), stats, relationship } });
    },
  );

  /** The last ACTIVITY_DAYS days of daily totals, one entry per day (zeros where not played). */
  app.get<{ Params: { username: string } }>(
    "/:username/activity",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { username: request.params.username } });
      if (!user) throw Errors.notFound("User not found");

      const to = getTodayKey(env.DEFAULT_TIMEZONE);
      const from = addDaysToKey(to, -(ACTIVITY_DAYS - 1));
      const scores = await prisma.dailyScore.findMany({
        where: { userId: user.id, date: { gte: dateKeyToJSDate(from), lte: dateKeyToJSDate(to) } },
        select: { date: true, totalScore: true, gamesCompleted: true, isPerfectDay: true },
      });
      const byDate = new Map(scores.map((s) => [jsDateToDateKey(s.date), s]));
      const days: ActivityDayDTO[] = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
        const date = addDaysToKey(from, i);
        const score = byDate.get(date);
        return {
          date,
          points: score?.totalScore ?? 0,
          gamesCompleted: score?.gamesCompleted ?? 0,
          perfectDay: score?.isPerfectDay ?? false,
        };
      });
      const data: ActivityDTO = { from, to, days };
      return reply.send({ data });
    },
  );

  app.get<{ Params: { username: string } }>(
    "/:username/achievements",
    { preHandler: app.requireAuth },
    async (request, reply) => {
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
    },
  );
};
