import type { FastifyPluginAsync } from "fastify";
import { updateGameSchema } from "@dailyloop/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";

export const adminGameRoutes: FastifyPluginAsync = async (app) => {
  app.get("/games", async (_request, reply) => {
    const games = await prisma.game.findMany({ orderBy: { sortOrder: "asc" } });
    return reply.send({ data: games });
  });

  app.patch<{ Params: { id: string } }>("/games/:id", async (request, reply) => {
    const body = updateGameSchema.parse(request.body);
    const game = await prisma.game.findUnique({ where: { id: request.params.id } });
    if (!game) throw Errors.notFound("Game not found");
    const updated = await prisma.game.update({ where: { id: game.id }, data: body });
    return reply.send({ data: updated });
  });
};
