import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate, addDaysToKey } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("leaderboard routes", () => {
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
    await prisma.dailyScore.deleteMany();
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

  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/leaderboard/daily" });
    expect(res.statusCode).toBe(401);
  });

  it("ranks today's daily leaderboard by score, descending", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");
    const today = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));

    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: today, totalScore: 90, gamesCompleted: 2 },
    });
    await prisma.dailyScore.create({
      data: { userId: sumit.userId, date: today, totalScore: 150, gamesCompleted: 3 },
    });

    const res = await app.inject({ method: "GET", url: "/api/leaderboard/daily", cookies: harry.cookies });
    const entries = res.json().data;
    expect(entries.map((e: { username: string }) => e.username)).toEqual(["sumit", "harry"]);
    expect(entries[0].rank).toBe(1);
    expect(entries[0].score).toBe(150);
  });

  it("sums each user's daily scores across the week for the weekly leaderboard", async () => {
    const harry = await registerUser("harry");
    const todayKey = getTodayKey("Asia/Kathmandu");

    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(todayKey), totalScore: 50, gamesCompleted: 1 },
    });
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(addDaysToKey(todayKey, -1)), totalScore: 30, gamesCompleted: 1 },
    });
    // Outside this week (9 days ago) — should not count.
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(addDaysToKey(todayKey, -9)), totalScore: 1000, gamesCompleted: 1 },
    });

    const res = await app.inject({ method: "GET", url: "/api/leaderboard/weekly", cookies: harry.cookies });
    const entry = res.json().data.find((e: { username: string }) => e.username === "harry");
    expect(entry.score).toBe(80);
  });

  it("sums every daily score ever for the all-time leaderboard", async () => {
    const harry = await registerUser("harry");
    const todayKey = getTodayKey("Asia/Kathmandu");

    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(todayKey), totalScore: 50, gamesCompleted: 1 },
    });
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(addDaysToKey(todayKey, -60)), totalScore: 200, gamesCompleted: 1 },
    });

    const res = await app.inject({ method: "GET", url: "/api/leaderboard/all-time", cookies: harry.cookies });
    const entry = res.json().data.find((e: { username: string }) => e.username === "harry");
    expect(entry.score).toBe(250);
  });
});
