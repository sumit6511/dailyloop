import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getTodayKey, dateKeyToJSDate, addDaysToKey } from "@dailyloop/shared";
import { registerGame } from "@dailyloop/game-engine";
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
      data: {
        slug: "connections",
        name: "Connections",
        description: "d",
        icon: "🟩",
        sortOrder: 0,
      },
    });
    await prisma.game.create({
      data: {
        slug: "disabled-game",
        name: "Disabled",
        description: "d",
        icon: "❌",
        sortOrder: 2,
        isEnabled: false,
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((g: { slug: string }) => g.slug)).toEqual([
      "connections",
      "word-guess",
    ]);
  });

  it("GET /games/schedule reports today and the next rollover in the puzzle timezone", async () => {
    const res = await app.inject({ method: "GET", url: "/api/games/schedule" });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.timezone).toBe("Asia/Kathmandu");
    expect(body.today).toBe(getTodayKey("Asia/Kathmandu"));
    const rollover = Date.parse(body.nextRolloverAt);
    expect(rollover).toBeGreaterThan(Date.now());
    expect(rollover - Date.now()).toBeLessThanOrEqual(24 * 3_600_000);
    expect(getTodayKey("Asia/Kathmandu", new Date(rollover))).toBe(addDaysToKey(body.today, 1));
  });

  it("answers malformed JSON with 400 and an oversized body with 413, not 500", async () => {
    const send = (payload: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "content-type": "application/json" },
        payload,
      });
    const malformed = await send("{not json");
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe("BAD_REQUEST");
    const oversized = await send(
      JSON.stringify({ emailOrUsername: "x".repeat(100_000), password: "y" }),
    );
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json().error.code).toBe("PAYLOAD_TOO_LARGE");
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

  it("auto-generates today's puzzle on first request when nothing was scheduled or published", async () => {
    const { cookies } = await registerUser("harry");
    await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/word-guess/today", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(true);

    const created = await prisma.dailyPuzzle.findFirst({ where: { game: { slug: "word-guess" } } });
    expect(created?.status).toBe("PUBLISHED");
    expect((created?.content as { answer: string }).answer).toMatch(/^[A-Z]{5}$/);
  });

  it("doesn't resurrect an ARCHIVED puzzle for today by auto-generating a replacement", async () => {
    const { cookies } = await registerUser("harry");
    const game = await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(getTodayKey("Asia/Kathmandu")),
        puzzleNumber: 1,
        status: "ARCHIVED",
        content: { answer: "CRANE" },
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/word-guess/today", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(false);
    // Still exactly the one ARCHIVED row — nothing new was created alongside it.
    expect(await prisma.dailyPuzzle.count({ where: { gameId: game.id } })).toBe(1);
  });

  it("degrades to unavailable (not a 500) when a game's generator throws", async () => {
    registerGame({
      id: "throwing-game",
      name: "Throwing Game",
      description: "d",
      icon: "💥",
      difficulty: "easy",
      contentSchema: z.any(),
      moveSchema: z.any(),
      generatePuzzle: () => {
        throw new Error("boom");
      },
      validateAttempt: () => ({ won: false, complete: false, mistakes: 0, result: {} }),
      calculateScore: () => ({
        base: 0,
        speedBonus: 0,
        accuracyBonus: 0,
        mistakePenalty: 0,
        hintPenalty: 0,
        total: 0,
      }),
      sanitizeForClient: () => null,
    });
    const { cookies } = await registerUser("harry");
    await prisma.game.create({
      data: {
        slug: "throwing-game",
        name: "Throwing Game",
        description: "d",
        icon: "💥",
        sortOrder: 0,
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/games/throwing-game/today", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(false);
  });

  it("404s for an unknown game slug", async () => {
    const { cookies } = await registerUser("harry");
    const res = await app.inject({
      method: "GET",
      url: "/api/games/does-not-exist/today",
      cookies,
    });
    expect(res.statusCode).toBe(404);
  });
});
