import type { FastifyPluginAsync } from "fastify";
import { getTodayKey, addDaysToKey } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { Errors } from "../lib/errors.js";
import { isAuthorizedCronRequest } from "../lib/cron-auth.js";
import { generatePuzzleForGame } from "../services/puzzle-generation.js";

/**
 * Bearer-token-guarded, not cookie-session-guarded (see isAuthorizedCronRequest) — meant to be
 * called by a scheduled external trigger (GitHub Actions), which can't hold a login session.
 * Registered as a sibling top-level route, NOT nested under adminRoutes, so it's unaffected by
 * that plugin's own requireAdmin preHandler hook.
 */
export const cronRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    if (!isAuthorizedCronRequest(request.headers.authorization, env.CRON_SECRET)) {
      throw Errors.unauthorized();
    }
  });

  app.post("/generate-tomorrow", async (_request, reply) => {
    const dateKey = addDaysToKey(getTodayKey(env.DEFAULT_TIMEZONE), 1);
    const games = await prisma.game.findMany({ where: { isEnabled: true } });

    const results = await Promise.all(
      games.map(async (game) => ({
        gameSlug: game.slug,
        result: (await generatePuzzleForGame(game.slug, dateKey, { status: "SCHEDULED" })).kind,
      })),
    );

    return reply.send({ data: { dateKey, results } });
  });
};
