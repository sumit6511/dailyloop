import type { Prisma, PrismaClient } from "@prisma/client";
import { ACHIEVEMENT_CATALOG } from "@dailyloop/shared";

type Tx = Prisma.TransactionClient | PrismaClient;

interface AchievementContext {
  won: boolean;
  currentStreak: number;
  isPerfectDay: boolean;
  durationMs: number;
  mistakeCount: number;
  hintsUsed: number;
}

const SPEED_DEMON_THRESHOLD_MS = 15_000;
const PUZZLE_MASTER_THRESHOLD = 50;

async function unlock(tx: Tx, userId: string, key: string): Promise<string | null> {
  const achievement = await tx.achievement.findUnique({ where: { key } });
  if (!achievement) return null;

  const existing = await tx.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return null;

  await tx.userAchievement.create({ data: { userId, achievementId: achievement.id } });
  return key;
}

/**
 * Evaluates and unlocks any newly-earned achievements after an attempt completes. Must run
 * inside the same transaction as the attempt/streak/DailyScore update it reads from, so the
 * numbers it evaluates (streak, perfect day) can't be stale relative to what was just written.
 * Returns the keys of achievements newly unlocked by this call (already-unlocked ones are skipped).
 */
export async function evaluateAchievements(tx: Tx, userId: string, context: AchievementContext): Promise<string[]> {
  const newlyUnlocked: string[] = [];

  const maybeUnlock = async (key: string) => {
    const result = await unlock(tx, userId, key);
    if (result) newlyUnlocked.push(result);
  };

  if (context.currentStreak >= 3) await maybeUnlock("STREAK_3");
  if (context.currentStreak >= 7) await maybeUnlock("STREAK_7");
  if (context.currentStreak >= 30) await maybeUnlock("STREAK_30");
  if (context.currentStreak >= 100) await maybeUnlock("STREAK_100");
  if (context.isPerfectDay) await maybeUnlock("PERFECT_DAY");
  // A win only — otherwise giving up instantly (e.g. submitting Number Puzzle unsolved) would count.
  if (context.won && context.durationMs < SPEED_DEMON_THRESHOLD_MS) await maybeUnlock("SPEED_DEMON");

  if (context.won) {
    const totalWins = await tx.gameAttempt.count({ where: { userId, won: true, status: "COMPLETED" } });
    if (totalWins === 1) await maybeUnlock("FIRST_WIN");
    if (context.mistakeCount === 0 && context.hintsUsed === 0) await maybeUnlock("FLAWLESS");

    // Every currently enabled game has at least one win.
    const [enabledGames, gamesWon] = await Promise.all([
      tx.game.findMany({ where: { isEnabled: true }, select: { id: true } }),
      tx.dailyPuzzle.findMany({
        where: { attempts: { some: { userId, won: true, status: "COMPLETED" } } },
        select: { gameId: true },
        distinct: ["gameId"],
      }),
    ]);
    const wonGameIds = new Set(gamesWon.map((p) => p.gameId));
    if (enabledGames.length > 0 && enabledGames.every((g) => wonGameIds.has(g.id))) await maybeUnlock("ALL_ROUNDER");
  }

  const totalCompleted = await tx.gameAttempt.count({ where: { userId, status: "COMPLETED" } });
  if (totalCompleted >= PUZZLE_MASTER_THRESHOLD) await maybeUnlock("PUZZLE_MASTER");

  return newlyUnlocked;
}

/**
 * Makes sure every achievement in the shared catalog has a DB row (and current wording). `unlock`
 * silently skips keys with no row, so without this an achievement added after a deployment was
 * seeded could never be earned. Idempotent; run at API startup.
 */
export async function syncAchievementCatalog(db: Tx): Promise<void> {
  for (const achievement of ACHIEVEMENT_CATALOG) {
    await db.achievement.upsert({ where: { key: achievement.key }, update: achievement, create: achievement });
  }
}
