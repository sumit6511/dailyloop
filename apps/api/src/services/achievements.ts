import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

interface AchievementContext {
  won: boolean;
  currentStreak: number;
  isPerfectDay: boolean;
  durationMs: number;
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
  if (context.isPerfectDay) await maybeUnlock("PERFECT_DAY");
  if (context.durationMs < SPEED_DEMON_THRESHOLD_MS) await maybeUnlock("SPEED_DEMON");

  if (context.won) {
    const totalWins = await tx.gameAttempt.count({ where: { userId, won: true, status: "COMPLETED" } });
    if (totalWins === 1) await maybeUnlock("FIRST_WIN");
  }

  const totalCompleted = await tx.gameAttempt.count({ where: { userId, status: "COMPLETED" } });
  if (totalCompleted >= PUZZLE_MASTER_THRESHOLD) await maybeUnlock("PUZZLE_MASTER");

  return newlyUnlocked;
}
