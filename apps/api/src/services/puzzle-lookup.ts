import { getTodayKey, dateKeyToJSDate } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

/**
 * Finds today's puzzle for a game, auto-publishing it first if it's still marked SCHEDULED but
 * its date has already arrived. Without this, a puzzle admin-scheduled for a future date would
 * stay SCHEDULED forever once that date becomes "today" — there's no cron/scheduled job in this
 * app to flip the status at midnight, so the very next request for it does that instead. Only
 * ever considers *today's* row, so a SCHEDULED puzzle dated for a real future day is untouched.
 */
export async function findTodaysPuzzle(gameId: string) {
  const date = dateKeyToJSDate(getTodayKey(env.DEFAULT_TIMEZONE));

  const published = await prisma.dailyPuzzle.findFirst({ where: { gameId, date, status: "PUBLISHED" } });
  if (published) return published;

  const due = await prisma.dailyPuzzle.findFirst({ where: { gameId, date, status: "SCHEDULED" } });
  if (!due) return null;

  return prisma.dailyPuzzle.update({ where: { id: due.id }, data: { status: "PUBLISHED" } });
}
