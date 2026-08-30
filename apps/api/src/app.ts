import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
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

export async function buildApp() {
  registerAllGames();

  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : env.NODE_ENV === "development"
          ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
          : true,
    trustProxy: true,
  });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  // Skipped in tests so integration suites that hit /auth/register or /login
  // repeatedly within one app instance don't flake against the shared limiter.
  if (env.NODE_ENV !== "test") {
    await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  }
  await app.register(csrfPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() },
      });
    }
    if (hasStatusCode(error, 429)) {
      return reply
        .status(429)
        .send({ error: { code: "RATE_LIMITED", message: "Too many requests — please slow down" } });
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

  return app;
}
