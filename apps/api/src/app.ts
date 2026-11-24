import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { registerAllGames } from "@dailyloop/game-engine";
import { env, corsOrigins } from "./config/env.js";
import { ApiError, hasStatusCode } from "./lib/errors.js";
import authPlugin from "./plugins/auth.js";
import csrfPlugin from "./plugins/csrf.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { gameRoutes } from "./routes/games.js";
import { meRoutes } from "./routes/me.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { friendRoutes } from "./routes/friends.js";
import { achievementRoutes } from "./routes/achievements.js";
import { adminRoutes } from "./routes/admin/index.js";
import { cronRoutes } from "./routes/cron.js";

export async function buildApp() {
  registerAllGames();

  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : env.NODE_ENV === "development"
          ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
          : true,
    // Never `true` by default: that trusts a client-supplied X-Forwarded-For outright, so anyone
    // could claim a fresh IP per request and walk straight past the login/register rate limits.
    trustProxy: env.TRUST_PROXY,
    // The largest legitimate body (an admin's puzzle JSON) is a few KB. A tight cap bounds how
    // much work validation can be made to do (zod's array-validation advisory) and memory per
    // request; Fastify's default is 1 MiB.
    bodyLimit: 64 * 1024,
  });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  // Skipped in tests so integration suites that hit /auth/register or /login
  // repeatedly within one app instance don't flake against the shared limiter.
  if (env.NODE_ENV !== "test") {
    await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  }
  // Baseline security headers for every API response. The API only serves JSON, so it should never
  // be framed, sniffed as another type, cached by intermediaries, or leak a referrer.
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cache-Control", "no-store");
    if (env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });
  await app.register(csrfPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    // The base class covers both classic zod (the API's own schemas) and zod/mini (the shared
    // schemas); mini's errors are not instances of classic ZodError.
    if (error instanceof z.core.$ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: z.flattenError(error) },
      });
    }
    // A unique-constraint race (two requests creating the same thing at once) or a write to a row
    // that was deleted in between is the client's conflict, not a server fault.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return reply.status(409).send({ error: { code: "CONFLICT", message: "That already exists" } });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    if (hasStatusCode(error, 429)) {
      return reply
        .status(429)
        .send({ error: { code: "RATE_LIMITED", message: "Too many requests — please slow down" } });
    }
    // Fastify's own client errors (malformed JSON, a body over the limit, an unsupported content
    // type, ...) carry a 4xx status — they're the caller's mistake, not a server fault.
    const clientStatus = (error as { statusCode?: unknown }).statusCode;
    if (typeof clientStatus === "number" && clientStatus >= 400 && clientStatus < 500) {
      const code = clientStatus === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST";
      const message = clientStatus === 413 ? "Request body is too large" : (error as Error).message;
      return reply.status(clientStatus).send({ error: { code, message } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send({ error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} not found` } });
  });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(gameRoutes, { prefix: "/api/games" });
  await app.register(meRoutes, { prefix: "/api/me" });
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  await app.register(friendRoutes, { prefix: "/api/friends" });
  await app.register(achievementRoutes, { prefix: "/api/achievements" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(cronRoutes, { prefix: "/api/cron" });

  return app;
}
