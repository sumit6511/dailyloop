import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate, addDaysToKey } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("game routes", () => {
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
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
    await prisma.session.deleteMany();
    await prisma.streak.deleteMany();
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
    return { cookies: { [cookie.name]: cookie.value } };
  }

  it("GET /games lists only enabled games, sorted", async () => {
    await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 1 },
    });
    await prisma.game.create({
      data: { slug: "connections", name: "Connections", description: "d", icon: "🟩", sortOrder: 0 },
    });
    await prisma.game.create({
      data: { slug: "disabled-game", name: "Disabled", description: "d", icon: "❌", sortOrder: 2, isEnabled: false },
    });

    const res = await app.inject({ method: "GET", url: "/api/games" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((g: { slug: string }) => g.slug)).toEqual(["connections", "word-guess"]);
  });

  it("GET /games/today requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/games/today" });
    expect(res.statusCode).toBe(401);
  });

  // "mock-game" deliberately has no game-engine module registered, matching or not — these
  // tests are about puzzle visibility plumbing, not any specific game's sanitization logic.
  it("only surfaces a PUBLISHED puzzle dated today, never a scheduled/future one", async () => {
    const { cookies } = await registerUser("harry");
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });

    const todayKey = getTodayKey("Asia/Kathmandu");
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(todayKey),
        puzzleNumber: 1,
        status: "PUBLISHED",
        content: { words: ["a"] },
      },
    });
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(addDaysToKey(todayKey, 1)),
        puzzleNumber: 2,
        status: "SCHEDULED",
        content: { words: ["b"] },
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/today", cookies });
    expect(res.statusCode).toBe(200);
    const entries = res.json().data;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      slug: "mock-game",
      available: true,
      puzzleNumber: 1,
      status: "not_started",
      content: null, // no game-engine module registered for this slug
    });
  });

  it("auto-publishes a SCHEDULED puzzle once its date has arrived (no cron job exists to do this)", async () => {
    const { cookies } = await registerUser("harry");
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(getTodayKey("Asia/Kathmandu")),
        puzzleNumber: 1,
        status: "SCHEDULED",
        content: { words: ["a"] },
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/mock-game/today", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(true);

    const updated = await prisma.dailyPuzzle.findUniqueOrThrow({ where: { id: puzzle.id } });
    expect(updated.status).toBe("PUBLISHED");
  });

  it("never exposes a SCHEDULED puzzle dated in the future, even after the auto-publish check runs", async () => {
    const { cookies } = await registerUser("harry");
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(addDaysToKey(getTodayKey("Asia/Kathmandu"), 1)),
        puzzleNumber: 1,
        status: "SCHEDULED",
        content: { words: ["a"] },
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/mock-game/today", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(false);
  });

  it("404s for an unknown game slug", async () => {
    const { cookies } = await registerUser("harry");
    const res = await app.inject({ method: "GET", url: "/api/games/does-not-exist/today", cookies });
    expect(res.statusCode).toBe(404);
  });
});
