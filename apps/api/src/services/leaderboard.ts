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

  // Standard competition ranking: equal scores share a rank and the next rank skips (1, 2, 2, 4).
  // Rows arrive sorted by score, highest first.
  let previous: { score: number; rank: number } | null = null;
  return rows
    .filter((row) => byId.has(row.userId))
    .map((row, index) => {
      const user = byId.get(row.userId)!;
      const rank = previous && previous.score === row.score ? previous.rank : index + 1;
      previous = { score: row.score, rank };
      return {
        userId: row.userId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        score: row.score,
        rank,
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

export interface MyRank {
  rank: number;
  score: number;
  /** How many players have a score in this range. */
  players: number;
}

/**
 * The caller's own position on the global leaderboard for a range, whether or not they made the
 * top-N list: 1 + the number of players with a strictly higher score (so ties share a rank,
 * matching the lists). Null when they have no score in that range yet.
 */
export async function getMyRank(userId: string, range: LeaderboardRange, dateKey: string): Promise<MyRank | null> {
  if (range === "daily") {
    const date = dateKeyToJSDate(dateKey);
    const mine = await prisma.dailyScore.findUnique({ where: { userId_date: { userId, date } } });
    if (!mine) return null;
    const [higher, players] = await Promise.all([
      prisma.dailyScore.count({ where: { date, totalScore: { gt: mine.totalScore } } }),
      prisma.dailyScore.count({ where: { date } }),
    ]);
    return { rank: higher + 1, score: mine.totalScore, players };
  }

  const where =
    range === "weekly"
      ? (() => {
          const { start, end } = getWeekRangeKeys(dateKey);
          return { date: { gte: dateKeyToJSDate(start), lte: dateKeyToJSDate(end) } };
        })()
      : {};
  const mine = await prisma.dailyScore.aggregate({ where: { ...where, userId }, _sum: { totalScore: true }, _count: true });
  if (mine._count === 0) return null;
  const myScore = mine._sum.totalScore ?? 0;
  const [higher, all] = await Promise.all([
    prisma.dailyScore.groupBy({
      by: ["userId"],
      where,
      having: { totalScore: { _sum: { gt: myScore } } },
    }),
    prisma.dailyScore.groupBy({ by: ["userId"], where }),
  ]);
  return { rank: higher.length + 1, score: myScore, players: all.length };
}
