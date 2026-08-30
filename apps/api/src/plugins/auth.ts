import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "@dailyloop/shared";
import { getUserBySessionToken } from "../lib/session.js";
import { Errors } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: User | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorateRequest("currentUser", null);

  app.addHook("preHandler", async (request) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return;
    request.currentUser = await getUserBySessionToken(token);
  });

  app.decorate("requireAuth", async (request: FastifyRequest) => {
    if (!request.currentUser) throw Errors.unauthorized();
  });

  app.decorate("requireAdmin", async (request: FastifyRequest) => {
    if (!request.currentUser) throw Errors.unauthorized();
    if (request.currentUser.role !== "ADMIN") throw Errors.forbidden("Admin access required");
  });
});
