import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createPuzzleSchema, updatePuzzleSchema, generatePuzzleSchema, dateKeyToJSDate, jsDateToDateKey } from "@dailyloop/shared";
import { getGameModule } from "@dailyloop/game-engine";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";

const listQuerySchema = z.object({
  gameSlug: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(["SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
});

async function nextPuzzleNumber(gameId: string): Promise<number> {
  return (await prisma.dailyPuzzle.count({ where: { gameId } })) + 1;
}

export const adminPuzzleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/puzzles", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const where: Prisma.DailyPuzzleWhereInput = {};

    if (query.gameSlug) {
      const game = await prisma.game.findUnique({ where: { slug: query.gameSlug } });
      if (!game) throw Errors.notFound("Game not found");
      where.gameId = game.id;
    }
    if (query.date) where.date = dateKeyToJSDate(query.date);
    if (query.status) where.status = query.status;

    const puzzles = await prisma.dailyPuzzle.findMany({
      where,
      include: { game: true },
      orderBy: [{ date: "desc" }, { game: { sortOrder: "asc" } }],
    });

    return reply.send({
      data: puzzles.map((p) => ({
        id: p.id,
        gameSlug: p.game.slug,
        gameName: p.game.name,
        date: jsDateToDateKey(p.date),
        puzzleNumber: p.puzzleNumber,
        status: p.status,
        publishAt: p.publishAt,
        content: p.content,
      })),
    });
  });

  app.get<{ Params: { id: string } }>("/puzzles/:id", async (request, reply) => {
    const puzzle = await prisma.dailyPuzzle.findUnique({
      where: { id: request.params.id },
      include: { game: true },
    });
    if (!puzzle) throw Errors.notFound("Puzzle not found");
    return reply.send({
      data: {
        id: puzzle.id,
        gameSlug: puzzle.game.slug,
        gameName: puzzle.game.name,
        date: jsDateToDateKey(puzzle.date),
        puzzleNumber: puzzle.puzzleNumber,
        status: puzzle.status,
        publishAt: puzzle.publishAt,
        content: puzzle.content,
      },
    });
  });

  app.post("/puzzles", async (request, reply) => {
    const body = createPuzzleSchema.parse(request.body);
    const game = await prisma.game.findUnique({ where: { slug: body.gameSlug } });
    if (!game) throw Errors.notFound("Game not found");

    const module = getGameModule(body.gameSlug);
    if (module) {
      const parsed = module.contentSchema.safeParse(body.content);
      if (!parsed.success) {
        throw Errors.badRequest("Puzzle content doesn't match this game's schema", parsed.error.flatten());
      }
    }

    const date = dateKeyToJSDate(body.date);
    const existing = await prisma.dailyPuzzle.findUnique({ where: { gameId_date: { gameId: game.id, date } } });
    if (existing) throw Errors.conflict(`A puzzle for ${game.slug} on ${body.date} already exists`);

    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date,
        puzzleNumber: await nextPuzzleNumber(game.id),
        status: body.status,
        publishAt: body.publishAt ? new Date(body.publishAt) : null,
        content: body.content as Prisma.InputJsonValue,
        createdById: request.currentUser!.id,
      },
    });

    return reply.status(201).send({ data: { ...puzzle, gameSlug: game.slug, date: body.date } });
  });

  app.put<{ Params: { id: string } }>("/puzzles/:id", async (request, reply) => {
    const body = updatePuzzleSchema.parse(request.body);
    const puzzle = await prisma.dailyPuzzle.findUnique({
      where: { id: request.params.id },
      include: { game: true },
    });
    if (!puzzle) throw Errors.notFound("Puzzle not found");

    if (body.content !== undefined) {
      const module = getGameModule(puzzle.game.slug);
      if (module) {
        const parsed = module.contentSchema.safeParse(body.content);
        if (!parsed.success) {
          throw Errors.badRequest("Puzzle content doesn't match this game's schema", parsed.error.flatten());
        }
      }
    }

    const updated = await prisma.dailyPuzzle.update({
      where: { id: puzzle.id },
      data: {
        ...(body.content !== undefined ? { content: body.content as Prisma.InputJsonValue } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.publishAt !== undefined ? { publishAt: body.publishAt ? new Date(body.publishAt) : null } : {}),
        ...(body.date !== undefined ? { date: dateKeyToJSDate(body.date) } : {}),
      },
    });

    return reply.send({ data: { ...updated, gameSlug: puzzle.game.slug, date: jsDateToDateKey(updated.date) } });
  });

  app.delete<{ Params: { id: string } }>("/puzzles/:id", async (request, reply) => {
    const puzzle = await prisma.dailyPuzzle.findUnique({ where: { id: request.params.id } });
    if (!puzzle) throw Errors.notFound("Puzzle not found");
    await prisma.dailyPuzzle.delete({ where: { id: puzzle.id } });
    return reply.send({ data: { ok: true } });
  });

  app.post("/puzzles/generate", async (request, reply) => {
    const body = generatePuzzleSchema.parse(request.body);
    const game = await prisma.game.findUnique({ where: { slug: body.gameSlug } });
    if (!game) throw Errors.notFound("Game not found");

    const module = getGameModule(body.gameSlug);
    if (!module) throw Errors.badRequest(`"${body.gameSlug}" doesn't have a generator implemented yet`);

    const date = dateKeyToJSDate(body.date);
    const existing = await prisma.dailyPuzzle.findUnique({ where: { gameId_date: { gameId: game.id, date } } });
    if (existing) throw Errors.conflict(`A puzzle for ${game.slug} on ${body.date} already exists`);

    const content = module.generatePuzzle(`${body.gameSlug}-${body.date}`, body.date);

    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date,
        puzzleNumber: await nextPuzzleNumber(game.id),
        status: "SCHEDULED",
        content: content as Prisma.InputJsonValue,
        createdById: request.currentUser!.id,
      },
    });

    return reply.status(201).send({ data: { ...puzzle, gameSlug: game.slug, date: body.date } });
  });
};
