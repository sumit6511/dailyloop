import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Healthy only if the database answers — the host's health check uses this to decide whether
   * to route traffic to an instance, and an API that can't reach Postgres can't serve anything.
   */
  app.get("/health", async (request, reply) => {
    const time = new Date().toISOString();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ data: { status: "ok", database: "ok", time } });
    } catch (error) {
      request.log.error(error, "Health check: database unreachable");
      return reply.status(503).send({ data: { status: "error", database: "unreachable", time } });
    }
  });
};
