import type { Game } from "@prisma/client";
import type { TodayGameEntryDTO } from "@dailyloop/shared";
import { getGameModule, type AttemptState } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { findTodaysPuzzle } from "./puzzle-lookup.js";

async function buildEntry(game: Game, userId: string): Promise<TodayGameEntryDTO> {
  const base = {
    slug: game.slug,
    name: game.name,
    description: game.description,
    icon: game.icon,
    difficulty: game.difficulty,
  };

  const puzzle = await findTodaysPuzzle(game.id);

  if (!puzzle) {
    return {
      ...base,
      available: false,
      puzzleNumber: null,
      status: "not_started",
      score: null,
      mistakeCount: null,
      content: null,
      startedAt: null,
    };
  }

  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_dailyPuzzleId: { userId, dailyPuzzleId: puzzle.id } },
  });

  const module = getGameModule(game.slug);
  const attemptState: AttemptState | null = attempt
    ? { status: attempt.status, moves: Array.isArray(attempt.attemptLog) ? attempt.attemptLog : [] }
    : null;
  const content = module ? module.sanitizeForClient(puzzle.content, attemptState) : null;

  return {
    ...base,
    available: true,
    puzzleNumber: puzzle.puzzleNumber,
    status: !attempt ? "not_started" : attempt.status === "COMPLETED" ? "completed" : "in_progress",
    score: attempt?.status === "COMPLETED" ? attempt.score : null,
    mistakeCount: attempt ? attempt.mistakeCount : null,
    content,
    startedAt: attempt ? attempt.startedAt.toISOString() : null,
  };
}

export async function getTodayLineup(userId: string): Promise<TodayGameEntryDTO[]> {
  const games = await prisma.game.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } });
  return Promise.all(games.map((game) => buildEntry(game, userId)));
}

export async function getTodayEntryForSlug(userId: string, slug: string): Promise<TodayGameEntryDTO | null> {
  const game = await prisma.game.findUnique({ where: { slug } });
  if (!game || !game.isEnabled) return null;
  return buildEntry(game, userId);
}
