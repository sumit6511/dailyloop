import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate, addDaysToKey, getWeekRangeKeys } from "@dailyloop/shared";
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
    // Pick a second date guaranteed to fall in the same calendar week as today but never equal
    // to it — "yesterday" doesn't work here since it falls in the *previous* week whenever the
    // test happens to run on the first day of a new week.
    const weekStartKey = getWeekRangeKeys(todayKey).start;
    const otherDayKey = todayKey === weekStartKey ? addDaysToKey(weekStartKey, 1) : weekStartKey;

    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(todayKey), totalScore: 50, gamesCompleted: 1 },
    });
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(otherDayKey), totalScore: 30, gamesCompleted: 1 },
    });
    // Outside this week (2 days before it starts) — should not count.
    await prisma.dailyScore.create({
      data: { userId: harry.userId, date: dateKeyToJSDate(addDaysToKey(weekStartKey, -2)), totalScore: 1000, gamesCompleted: 1 },
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

  it("gives tied scores the same rank and skips the next one (1, 2, 2, 4)", async () => {
    const today = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    const players = await Promise.all(["ann", "ben", "cat", "dan"].map((name) => registerUser(name)));
    const scores = [150, 90, 90, 40];
    await prisma.dailyScore.createMany({
      data: players.map((p, i) => ({ userId: p.userId, date: today, totalScore: scores[i]!, gamesCompleted: 1 })),
    });
    const res = await app.inject({ method: "GET", url: "/api/leaderboard/daily", cookies: players[0]!.cookies });
    expect(res.json().data.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 2, 4]);
  });

  it("reports your own rank for each range, sharing ties, or null with no score", async () => {
    const todayKey = getTodayKey("Asia/Kathmandu");
    const today = dateKeyToJSDate(todayKey);
    const [me, rival, tied] = await Promise.all([registerUser("myself"), registerUser("rival"), registerUser("tied")]);
    const outsideWeek = dateKeyToJSDate(addDaysToKey(getWeekRangeKeys(todayKey).start, -1));
    await prisma.dailyScore.createMany({
      data: [
        { userId: me.userId, date: today, totalScore: 50, gamesCompleted: 1 },
        { userId: rival.userId, date: today, totalScore: 80, gamesCompleted: 1 },
        { userId: tied.userId, date: today, totalScore: 50, gamesCompleted: 1 },
        // Last week: counts for all-time only, and lifts me above the rival there.
        { userId: me.userId, date: outsideWeek, totalScore: 100, gamesCompleted: 2 },
      ],
    });
    const mine = async (range: string, cookies = me.cookies) =>
      (await app.inject({ method: "GET", url: `/api/leaderboard/me?range=${range}`, cookies })).json().data;

    expect(await mine("daily")).toEqual({ rank: 2, score: 50, players: 3 });
    expect(await mine("daily", tied.cookies)).toEqual({ rank: 2, score: 50, players: 3 });
    expect(await mine("weekly")).toEqual({ rank: 2, score: 50, players: 3 });
    expect(await mine("all-time")).toEqual({ rank: 1, score: 150, players: 3 });

    const newcomer = await registerUser("newcomer");
    expect(await mine("daily", newcomer.cookies)).toBeNull();
  });
});
