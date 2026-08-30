import { dateKeyToJSDate, getWeekRangeKeys } from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { getFriendIds } from "./friends.js";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  rank: number;
}

export type LeaderboardRange = "daily" | "weekly" | "all-time";

const DEFAULT_LIMIT = 50;

async function toEntries(rows: { userId: string; score: number }[]): Promise<LeaderboardEntry[]> {
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows
    .filter((row) => byId.has(row.userId))
    .map((row, index) => {
      const user = byId.get(row.userId)!;
      return {
        userId: row.userId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        score: row.score,
        rank: index + 1,
      };
    });
}

interface ScopeOptions {
  /** Restrict to these user IDs (e.g. the caller + their friends). Omit for a global leaderboard. */
  userIds?: string[];
  limit?: number;
}

export async function getDailyLeaderboard(dateKey: string, options: ScopeOptions = {}): Promise<LeaderboardEntry[]> {
  const rows = await prisma.dailyScore.findMany({
    where: { date: dateKeyToJSDate(dateKey), ...(options.userIds ? { userId: { in: options.userIds } } : {}) },
    orderBy: { totalScore: "desc" },
    take: options.limit ?? DEFAULT_LIMIT,
    select: { userId: true, totalScore: true },
  });
  return toEntries(rows.map((r) => ({ userId: r.userId, score: r.totalScore })));
}

export async function getWeeklyLeaderboard(dateKey: string, options: ScopeOptions = {}): Promise<LeaderboardEntry[]> {
  const { start, end } = getWeekRangeKeys(dateKey);
  const grouped = await prisma.dailyScore.groupBy({
    by: ["userId"],
    where: {
      date: { gte: dateKeyToJSDate(start), lte: dateKeyToJSDate(end) },
      ...(options.userIds ? { userId: { in: options.userIds } } : {}),
    },
    _sum: { totalScore: true },
    orderBy: { _sum: { totalScore: "desc" } },
    take: options.limit ?? DEFAULT_LIMIT,
  });
  return toEntries(grouped.map((g) => ({ userId: g.userId, score: g._sum.totalScore ?? 0 })));
}

export async function getAllTimeLeaderboard(options: ScopeOptions = {}): Promise<LeaderboardEntry[]> {
  const grouped = await prisma.dailyScore.groupBy({
    by: ["userId"],
    where: options.userIds ? { userId: { in: options.userIds } } : undefined,
    _sum: { totalScore: true },
    orderBy: { _sum: { totalScore: "desc" } },
    take: options.limit ?? DEFAULT_LIMIT,
  });
  return toEntries(grouped.map((g) => ({ userId: g.userId, score: g._sum.totalScore ?? 0 })));
}

export async function getFriendsLeaderboard(
  userId: string,
  range: LeaderboardRange,
  dateKey: string,
): Promise<LeaderboardEntry[]> {
  const friendIds = await getFriendIds(userId);
  const userIds = [userId, ...friendIds];
  if (range === "daily") return getDailyLeaderboard(dateKey, { userIds });
  if (range === "weekly") return getWeeklyLeaderboard(dateKey, { userIds });
  return getAllTimeLeaderboard({ userIds });
}
