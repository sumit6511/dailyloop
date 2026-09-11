import { getTodayKey, dateKeyToJSDate } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { generatePuzzleForGame } from "./puzzle-generation.js";

/**
 * Finds today's puzzle for a game, auto-publishing it first if it's still marked SCHEDULED but
 * its date has already arrived (there's no cron/scheduled job in this app to flip the status at
 * midnight, so the very next request for it does that instead), and — if nobody scheduled or
 * generated anything for today at all — generating one on the spot rather than leaving players
 * with "no puzzle available." Only ever considers *today's* row, so a SCHEDULED puzzle dated for
 * a real future day is untouched.
 */
export async function findTodaysPuzzle(gameId: string, gameSlug: string) {
  const dateKey = getTodayKey(env.DEFAULT_TIMEZONE);
  const date = dateKeyToJSDate(dateKey);

  const published = await prisma.dailyPuzzle.findFirst({ where: { gameId, date, status: "PUBLISHED" } });
  if (published) return published;

  const due = await prisma.dailyPuzzle.findFirst({ where: { gameId, date, status: "SCHEDULED" } });
  if (due) return prisma.dailyPuzzle.update({ where: { id: due.id }, data: { status: "PUBLISHED" } });

  // A thrown generator error, a missing module, or a same-date ARCHIVED row already occupying
  // the unique (gameId, date) slot all degrade to "still unavailable" (null) instead of breaking
  // the caller — e.g. one broken game shouldn't 500 the whole dashboard's today-lineup fetch.
  try {
    const result = await generatePuzzleForGame(gameSlug, dateKey, { status: "PUBLISHED" });
    return result.kind === "created" ? result.puzzle : null;
  } catch {
    return null;
  }
}
