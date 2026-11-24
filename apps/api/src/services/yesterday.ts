import type { YesterdayAnswersDTO, YesterdayGameDTO } from "@dailyloop/shared";
import { addDaysToKey, dateKeyToJSDate, getTodayKey } from "@dailyloop/shared";
import { getGameModule } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

/**
 * Yesterday's answers, with how the player got on. Only today's puzzle can be played (every
 * attempt route looks up today's), so revealing yesterday's can't spoil a live game. Only
 * PUBLISHED puzzles count: an ARCHIVED one was withdrawn, and a SCHEDULED one was never opened.
 */
export async function getYesterdayAnswers(
  userId: string,
  now: Date = new Date(),
): Promise<YesterdayAnswersDTO> {
  const date = addDaysToKey(getTodayKey(env.DEFAULT_TIMEZONE, now), -1);
  const puzzles = await prisma.dailyPuzzle.findMany({
    where: { date: dateKeyToJSDate(date), status: "PUBLISHED", game: { isEnabled: true } },
    include: { game: true, attempts: { where: { userId } } },
    orderBy: { game: { sortOrder: "asc" } },
  });

  const games: YesterdayGameDTO[] = [];
  for (const puzzle of puzzles) {
    const module = getGameModule(puzzle.game.slug);
    if (!module?.revealAnswer) continue;
    const parsed = module.contentSchema.safeParse(puzzle.content);
    if (!parsed.success) continue; // malformed content shouldn't take the whole card down
    const attempt = puzzle.attempts[0];
    const completed = attempt?.status === "COMPLETED";
    games.push({
      slug: puzzle.game.slug,
      name: puzzle.game.name,
      icon: puzzle.game.icon,
      puzzleNumber: puzzle.puzzleNumber,
      answer: module.revealAnswer(parsed.data),
      result: attempt
        ? { completed, won: completed && attempt.won, score: completed ? attempt.score : null }
        : null,
    });
  }
  return { date, games };
}
