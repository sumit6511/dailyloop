import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getTodayKey } from "@dailyloop/shared";
import { env } from "../config/env.js";
import {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getAllTimeLeaderboard,
  getFriendsLeaderboard,
  type LeaderboardRange,
} from "../services/leaderboard.js";

const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const friendsQuerySchema = dateQuerySchema.extend({
  range: z.enum(["daily", "weekly", "all-time"]).default("daily"),
});

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/daily", async (request, reply) => {
    const query = dateQuerySchema.parse(request.query);
    const dateKey = query.date ?? getTodayKey(env.DEFAULT_TIMEZONE);
    return reply.send({ data: await getDailyLeaderboard(dateKey) });
  });

  app.get("/weekly", async (request, reply) => {
    const query = dateQuerySchema.parse(request.query);
    const dateKey = query.date ?? getTodayKey(env.DEFAULT_TIMEZONE);
    return reply.send({ data: await getWeeklyLeaderboard(dateKey) });
  });

  app.get("/all-time", async (_request, reply) => {
    return reply.send({ data: await getAllTimeLeaderboard() });
  });

  app.get("/friends", async (request, reply) => {
    const query = friendsQuerySchema.parse(request.query);
    const dateKey = query.date ?? getTodayKey(env.DEFAULT_TIMEZONE);
    const data = await getFriendsLeaderboard(request.currentUser!.id, query.range as LeaderboardRange, dateKey);
    return reply.send({ data });
  });
};
