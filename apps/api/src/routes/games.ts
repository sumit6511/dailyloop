import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getTodayKey, type GameDTO } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { env } from "../config/env.js";
import { getTodayLineup, getTodayEntryForSlug } from "../services/games-today.js";
import { startAttempt, submitMove, checkAttempt, undoLastMove, getHint } from "../services/attempts.js";

// Undo is only safe where reversing a move doesn't erase a genuine mistake's scoring impact —
// see the doc comment on `undoLastMove` for why this isn't offered to every game.
const UNDO_ENABLED_SLUGS = new Set(["number-puzzle"]);

const submitBodySchema = z.object({ move: z.unknown() });

const EMOJI_BY_STATUS: Record<string, string> = { correct: "🟩", present: "🟨", absent: "⬜" };

/** Wordle-style emoji grid — colors only, never the actual letters or answer. */
function wordGuessEmojiGrid(content: unknown): string | undefined {
  const view = content as { guesses?: { feedback: { status: string }[] }[] } | null;
  if (!view?.guesses?.length) return undefined;
  return view.guesses.map((g) => g.feedback.map((f) => EMOJI_BY_STATUS[f.status] ?? "⬜").join("")).join("\n");
}

export const gameRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    const games = await prisma.game.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } });
    const data: GameDTO[] = games.map((g) => ({
      slug: g.slug,
      name: g.name,
      description: g.description,
      icon: g.icon,
      difficulty: g.difficulty,
    }));
    return reply.send({ data });
  });

  app.get("/today", { preHandler: app.requireAuth }, async (request, reply) => {
    const data = await getTodayLineup(request.currentUser!.id);
    return reply.send({ data });
  });

  app.get("/share/today", { preHandler: app.requireAuth }, async (request, reply) => {
    const lineup = await getTodayLineup(request.currentUser!.id);
    const completed = lineup.filter((g) => g.status === "completed");
    const streak = await prisma.streak.findUnique({ where: { userId: request.currentUser!.id } });

    return reply.send({
      data: {
        date: getTodayKey(env.DEFAULT_TIMEZONE),
        games: completed.map((g) => ({
          slug: g.slug,
          icon: g.icon,
          name: g.name,
          score: g.score,
          ...(g.slug === "word-guess" ? { pattern: wordGuessEmojiGrid(g.content) } : {}),
        })),
        totalScore: completed.reduce((sum, g) => sum + (g.score ?? 0), 0),
        currentStreak: streak?.currentStreak ?? 0,
      },
    });
  });

  app.get<{ Params: { slug: string } }>(
    "/:slug/today",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const entry = await getTodayEntryForSlug(request.currentUser!.id, request.params.slug);
      if (!entry) throw Errors.notFound("Game not found");
      return reply.send({ data: entry });
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/:slug/attempts/start",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const result = await startAttempt(request.currentUser!.id, request.params.slug);
      if (result.kind === "no_module_or_game") throw Errors.notFound("Game not found");
      if (result.kind === "not_available") {
        throw Errors.badRequest("No puzzle is available for this game today");
      }
      return reply.send({ data: { status: result.status, content: result.content } });
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/:slug/attempts/check",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const result = await checkAttempt(request.currentUser!.id, request.params.slug);
      if (result.kind === "no_module_or_game") throw Errors.notFound("Game not found");
      if (result.kind === "not_supported") throw Errors.badRequest("This game doesn't support checking progress");
      if (result.kind === "not_available") {
        throw Errors.badRequest("No puzzle is available for this game today");
      }
      if (result.kind === "not_started") throw Errors.badRequest("Start the game before checking your progress");
      return reply.send({ data: result.result });
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/:slug/attempts/hint",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const result = await getHint(request.currentUser!.id, request.params.slug);
      if (result.kind === "no_module_or_game") throw Errors.notFound("Game not found");
      if (result.kind === "not_supported") throw Errors.badRequest("This game doesn't support hints");
      if (result.kind === "not_available") {
        throw Errors.badRequest("No puzzle is available for this game today");
      }
      if (result.kind === "not_started") throw Errors.badRequest("Start the game before asking for a hint");
      return reply.send({ data: result.suggestion });
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/:slug/attempts/undo",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!UNDO_ENABLED_SLUGS.has(request.params.slug)) {
        throw Errors.badRequest("This game doesn't support undo");
      }
      const result = await undoLastMove(request.currentUser!.id, request.params.slug);
      if (result.kind === "no_module_or_game") throw Errors.notFound("Game not found");
      if (result.kind === "not_available") {
        throw Errors.badRequest("No puzzle is available for this game today");
      }
      if (result.kind === "not_started") throw Errors.badRequest("Start the game before undoing a move");
      if (result.kind === "already_completed") throw Errors.badRequest("This puzzle is already complete");
      if (result.kind === "nothing_to_undo") throw Errors.badRequest("There's nothing to undo yet");
      return reply.send({ data: { content: result.content } });
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/:slug/attempts/submit",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = submitBodySchema.parse(request.body);
      const result = await submitMove(request.currentUser!.id, request.params.slug, body.move);

      if (result.kind === "no_module_or_game") throw Errors.notFound("Game not found");
      if (result.kind === "not_available") {
        throw Errors.badRequest("No puzzle is available for this game today");
      }
      if (result.kind === "not_started") throw Errors.badRequest("Start the game before submitting a move");
      if (result.kind === "invalid_move") throw Errors.badRequest("Invalid move", result.details);
      if (result.kind === "already_completed") {
        return reply.send({ data: { complete: true, alreadyCompleted: true, content: result.content } });
      }
      return reply.send({
        data: {
          complete: result.complete,
          won: result.won,
          score: result.score,
          content: result.content,
          newlyUnlockedAchievements: result.newlyUnlockedAchievements,
        },
      });
    },
  );
};
