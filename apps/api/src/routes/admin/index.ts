import type { FastifyPluginAsync } from "fastify";
import { adminGameRoutes } from "./games.js";
import { adminPuzzleRoutes } from "./puzzles.js";
import { adminUserRoutes } from "./users.js";
import { adminReportRoutes } from "./reports.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAdmin);
  await app.register(adminGameRoutes);
  await app.register(adminPuzzleRoutes);
  await app.register(adminUserRoutes);
  await app.register(adminReportRoutes);
};
