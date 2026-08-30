import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate, addDaysToKey, ACHIEVEMENT_CATALOG } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const CONNECTIONS_CONTENT = {
  categories: [
    { title: "A", difficulty: 1, words: ["ONE", "TWO", "THREE", "FOUR"] },
    { title: "B", difficulty: 2, words: ["FIVE", "SIX", "SEVEN", "EIGHT"] },
    { title: "C", difficulty: 3, words: ["NINE", "TEN", "ELEVEN", "TWELVE"] },
    { title: "D", difficulty: 4, words: ["RED", "BLUE", "GREEN", "PINK"] },
  ],
  words: [
    "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT",
    "NINE", "TEN", "ELEVEN", "TWELVE", "RED", "BLUE", "GREEN", "PINK",
  ],
};

describe("achievements", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    for (const achievement of ACHIEVEMENT_CATALOG) {
      await prisma.achievement.upsert({ where: { key: achievement.key }, update: achievement, create: achievement });
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.userAchievement.deleteMany();
    await prisma.gameAttempt.deleteMany();
    await prisma.dailyScore.deleteMany();
    await prisma.streak.deleteMany();
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  async function registerUser(username: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: `${username}@example.com`,
        username,
        password: "correct-horse-battery",
        displayName: username,
      },
    });
    const cookie = res.cookies.find((c) => c.name === "dp_session")!;
    return { userId: res.json().data.id as string, cookies: { [cookie.name]: cookie.value } };
  }

  async function publishConnectionsToday() {
    const game = await prisma.game.create({
      data: { slug: "connections", name: "Connections", description: "d", icon: "🟩", sortOrder: 0 },
    });
    const date = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    await prisma.dailyPuzzle.create({
      data: { gameId: game.id, date, puzzleNumber: 1, status: "PUBLISHED", content: CONNECTIONS_CONTENT },
    });
    return game;
  }

  async function winConnections(cookies: Record<string, string>) {
    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });
    let last;
    for (const category of CONNECTIONS_CONTENT.categories) {
      last = await app.inject({
        method: "POST",
        url: "/api/games/connections/attempts/submit",
        cookies,
        payload: { move: { words: category.words } },
      });
    }
    return last!.json().data;
  }

  it("GET /achievements returns the full catalog", async () => {
    const { cookies } = await registerUser("harry");
    const res = await app.inject({ method: "GET", url: "/api/achievements", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(ACHIEVEMENT_CATALOG.length);
  });

  it("unlocks FIRST_WIN on a user's first-ever win, and it shows up in /me/achievements", async () => {
    const { userId, cookies } = await registerUser("harry");
    await publishConnectionsToday();

    const body = await winConnections(cookies);
    expect(body.newlyUnlockedAchievements).toContain("FIRST_WIN");

    const unlocked = await prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } });
    expect(unlocked.map((u) => u.achievement.key)).toContain("FIRST_WIN");

    const res = await app.inject({ method: "GET", url: "/api/me/achievements", cookies });
    expect(res.json().data.some((a: { key: string }) => a.key === "FIRST_WIN")).toBe(true);
  });

  it("GET /users/:username/achievements returns another user's unlocked achievements publicly", async () => {
    await registerUser("harry");
    await publishConnectionsToday();
    const { cookies } = await registerUser("sumit");
    await winConnections(cookies);

    const res = await app.inject({ method: "GET", url: "/api/users/sumit/achievements" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.some((a: { key: string }) => a.key === "FIRST_WIN")).toBe(true);
  });

  it("GET /users/:username/achievements 404s for an unknown username", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/nobody/achievements" });
    expect(res.statusCode).toBe(404);
  });

  it("does not unlock FIRST_WIN a second time on a later win", async () => {
    const { cookies } = await registerUser("harry");
    await publishConnectionsToday();
    await winConnections(cookies);

    // Simulate a second day's win by resetting today's attempt state and re-winning.
    await prisma.gameAttempt.deleteMany();
    await prisma.dailyScore.deleteMany();
    const body = await winConnections(cookies);
    expect(body.newlyUnlockedAchievements).not.toContain("FIRST_WIN");
  });

  it("unlocks STREAK_3 when a win extends the streak to 3", async () => {
    const { userId, cookies } = await registerUser("harry");
    await publishConnectionsToday();
    const todayKey = getTodayKey("Asia/Kathmandu");

    await prisma.streak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 2,
        longestStreak: 2,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -1)),
      },
      update: {
        currentStreak: 2,
        longestStreak: 2,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -1)),
      },
    });

    const body = await winConnections(cookies);
    expect(body.newlyUnlockedAchievements).toContain("STREAK_3");
  });

  it("unlocks PERFECT_DAY only once every published game that day is completed", async () => {
    const { cookies } = await registerUser("harry");
    await publishConnectionsToday();
    const body = await winConnections(cookies);
    expect(body.newlyUnlockedAchievements).toContain("PERFECT_DAY");
  });
});
