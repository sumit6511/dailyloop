import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate } from "@dailyloop/shared";
import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

describe("admin reporting routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.gameAttempt.deleteMany();
    await prisma.dailyScore.deleteMany();
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
    await prisma.session.deleteMany();
    await prisma.streak.deleteMany();
    await prisma.user.deleteMany();
  });

  async function registerAndGetCookies(username: string, role: "USER" | "ADMIN" = "USER") {
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
    if (role === "ADMIN") {
      await prisma.user.update({ where: { id: res.json().data.id }, data: { role: "ADMIN" } });
    }
    const cookie = res.cookies.find((c) => c.name === "dp_session")!;
    return { userId: res.json().data.id as string, cookies: { [cookie.name]: cookie.value } };
  }

  it("rejects non-admins from all reporting routes", async () => {
    const user = await registerAndGetCookies("harry", "USER");
    for (const url of ["/api/admin/users", "/api/admin/stats/overview", "/api/admin/activity"]) {
      const res = await app.inject({ method: "GET", url, cookies: user.cookies });
      expect(res.statusCode).toBe(403);
    }
  });

  it("lists users with their basic stats", async () => {
    const admin = await registerAndGetCookies("admin1", "ADMIN");
    await registerAndGetCookies("harry", "USER");

    const res = await app.inject({ method: "GET", url: "/api/admin/users", cookies: admin.cookies });
    expect(res.statusCode).toBe(200);
    const usernames = res.json().data.map((u: { username: string }) => u.username);
    expect(usernames).toEqual(expect.arrayContaining(["admin1", "harry"]));
  });

  it("summarizes per-game stats in the overview", async () => {
    const admin = await registerAndGetCookies("admin1", "ADMIN");
    await prisma.game.create({
      data: { slug: "connections", name: "Connections", description: "d", icon: "🟩", sortOrder: 0 },
    });

    const res = await app.inject({ method: "GET", url: "/api/admin/stats/overview", cookies: admin.cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.games.some((g: { slug: string }) => g.slug === "connections")).toBe(true);
  });

  it("reports today's activity, including perfect-day counts", async () => {
    const admin = await registerAndGetCookies("admin1", "ADMIN");
    const harry = await registerAndGetCookies("harry", "USER");
    const today = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: today, totalScore: 120, gamesCompleted: 5, isPerfectDay: true },
    });

    const res = await app.inject({ method: "GET", url: "/api/admin/activity", cookies: admin.cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.activeUsers).toBe(1);
    expect(body.perfectDays).toBe(1);
    expect(body.topScores[0]).toMatchObject({ username: "harry", score: 120, isPerfectDay: true });
  });
});
