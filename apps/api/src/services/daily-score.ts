import type { Prisma, PrismaClient } from "@prisma/client";
import { SCORE } from "@dailyloop/shared";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Recomputes one player's DailyScore for one date from scratch — never incrementally, so it
 * can't drift — from the attempts and puzzles that exist right now. Removes the row when no
 * completed attempt remains (e.g. the only game they finished that day was deleted).
 *
 * A Perfect Day means finishing every puzzle that counts that day: one per *enabled* game, whether
 * or not anyone has opened it yet (SCHEDULED rows are published lazily on first lookup, so a
 * PUBLISHED-only count could be 1 for an early riser), and never a disabled game's puzzle, which
 * nobody can play.
 */
export async function recomputeDailyScore(tx: Tx, userId: string, date: Date) {
  const completed = await tx.gameAttempt.findMany({
    where: { userId, status: "COMPLETED", dailyPuzzle: { date } },
    select: { score: true, dailyPuzzleId: true },
  });
  if (completed.length === 0) {
    await tx.dailyScore.deleteMany({ where: { userId, date } });
    return null;
  }

  const requiredPuzzles = await tx.dailyPuzzle.findMany({
    where: { date, status: { in: ["SCHEDULED", "PUBLISHED"] }, game: { isEnabled: true } },
    select: { id: true },
  });
  const completedPuzzleIds = new Set(completed.map((a) => a.dailyPuzzleId));
  const gamesCompleted = completed.length;
  const isPerfectDay = requiredPuzzles.length > 0 && requiredPuzzles.every((p) => completedPuzzleIds.has(p.id));
  const rawTotal = completed.reduce((sum, a) => sum + a.score, 0);
  const totalScore = rawTotal + (isPerfectDay ? SCORE.PERFECT_DAY_BONUS : 0);

  return tx.dailyScore.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, totalScore, gamesCompleted, isPerfectDay },
    update: { totalScore, gamesCompleted, isPerfectDay },
  });
}

/**
 * After an admin changes which puzzles count for a day (deleting or archiving one, moving its
 * date, enabling or disabling a game), every player with a score that day may now have a
 * different total or Perfect Day status. Streaks are deliberately left as they are: rewriting a
 * player's streak history after the fact would be more surprising than a stale streak.
 */
export async function recomputeDailyScoresForDate(tx: Tx, date: Date): Promise<number> {
  const players = await tx.dailyScore.findMany({ where: { date }, select: { userId: true } });
  for (const { userId } of players) await recomputeDailyScore(tx, userId, date);
  return players.length;
}
