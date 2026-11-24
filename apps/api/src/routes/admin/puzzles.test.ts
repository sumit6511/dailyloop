import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { addDaysToKey, dateKeyToJSDate, getTodayKey, SCORE } from "@dailyloop/shared";
import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

describe("admin puzzle routes", () => {
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
    return { [cookie.name]: cookie.value };
  }

  it("rejects anonymous and non-admin access", async () => {
    const userCookies = await registerAndGetCookies("harry", "USER");

    const anon = await app.inject({ method: "GET", url: "/api/admin/puzzles" });
    expect(anon.statusCode).toBe(401);

    const nonAdmin = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: userCookies,
    });
    expect(nonAdmin.statusCode).toBe(403);
  });

  it("creates, lists, updates (publishes), and deletes a puzzle", async () => {
    const adminCookies = await registerAndGetCookies("admin1", "ADMIN");
    await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const dateKey = getTodayKey("Asia/Kathmandu");

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles",
      cookies: adminCookies,
      payload: {
        gameSlug: "mock-game",
        date: dateKey,
        content: { words: ["a", "b"] },
        status: "SCHEDULED",
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json().data;
    expect(body.puzzleNumber).toBe(1);
    const puzzleId = body.id as string;

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: adminCookies,
    });
    expect(listed.json().data).toHaveLength(1);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/admin/puzzles/${puzzleId}`,
      cookies: adminCookies,
      payload: { status: "PUBLISHED" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.status).toBe("PUBLISHED");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/admin/puzzles/${puzzleId}`,
      cookies: adminCookies,
    });
    expect(deleted.statusCode).toBe(200);

    const listedAfter = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: adminCookies,
    });
    expect(listedAfter.json().data).toHaveLength(0);
  });

  it("rejects creating a second puzzle for the same game+date", async () => {
    const adminCookies = await registerAndGetCookies("admin2", "ADMIN");
    await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const payload = {
      gameSlug: "mock-game",
      date: getTodayKey("Asia/Kathmandu"),
      content: {},
      status: "SCHEDULED" as const,
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles",
      cookies: adminCookies,
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles",
      cookies: adminCookies,
      payload,
    });
    expect(second.statusCode).toBe(409);
  });

  it("409s (not 500s) moving a puzzle onto a date that already has one", async () => {
    const adminCookies = await registerAndGetCookies("admin3", "ADMIN");
    await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const today = getTodayKey("Asia/Kathmandu");
    const create = (date: string) =>
      app.inject({
        method: "POST",
        url: "/api/admin/puzzles",
        cookies: adminCookies,
        payload: { gameSlug: "mock-game", date, content: {}, status: "SCHEDULED" },
      });
    await create(today);
    const tomorrow = (await create(addDaysToKey(today, 1))).json().data;

    const moved = await app.inject({
      method: "PUT",
      url: `/api/admin/puzzles/${tomorrow.id}`,
      cookies: adminCookies,
      payload: { date: today },
    });
    expect(moved.statusCode).toBe(409);
  });

  it("refuses to generate a puzzle for a game with no engine module yet", async () => {
    const adminCookies = await registerAndGetCookies("admin3", "ADMIN");
    await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: adminCookies,
      payload: { gameSlug: "mock-game", date: getTodayKey("Asia/Kathmandu") },
    });
    expect(res.statusCode).toBe(400);
  });

  it("404s generating a puzzle for an unknown game", async () => {
    const adminCookies = await registerAndGetCookies("admin4", "ADMIN");

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: adminCookies,
      payload: { gameSlug: "does-not-exist", date: getTodayKey("Asia/Kathmandu") },
    });
    expect(res.statusCode).toBe(404);
  });

  it("generates a real puzzle using the game's own generator, then 409s a repeat for the same game+date", async () => {
    const adminCookies = await registerAndGetCookies("admin5", "ADMIN");
    await prisma.game.create({
      data: {
        slug: "logic-puzzle",
        name: "Logic Puzzle",
        description: "d",
        icon: "🧠",
        sortOrder: 0,
      },
    });
    const payload = { gameSlug: "logic-puzzle", date: getTodayKey("Asia/Kathmandu") };

    const first = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: adminCookies,
      payload,
    });
    expect(first.statusCode).toBe(201);
    const body = first.json().data;
    expect(body.status).toBe("SCHEDULED");
    expect(body.content.puzzle).toBeDefined();
    expect(body.content.solution).toBeDefined();

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: adminCookies,
      payload,
    });
    expect(second.statusCode).toBe(409);
  });

  it("recomputes that day's scores and Perfect Days when a puzzle is deleted", async () => {
    const adminCookies = await registerAndGetCookies("admin4", "ADMIN");
    const date = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    const makeGame = (slug: string, sortOrder: number) =>
      prisma.game.create({ data: { slug, name: slug, description: "d", icon: "🧪", sortOrder } });
    const [gameA, gameB] = [await makeGame("game-a", 0), await makeGame("game-b", 1)];
    const puzzleA = await prisma.dailyPuzzle.create({
      data: { gameId: gameA.id, date, puzzleNumber: 1, status: "PUBLISHED", content: {} },
    });
    const puzzleB = await prisma.dailyPuzzle.create({
      data: { gameId: gameB.id, date, puzzleNumber: 1, status: "PUBLISHED", content: {} },
    });

    const player = (name: string) =>
      prisma.user.create({
        data: {
          email: `${name}@example.com`,
          username: name,
          passwordHash: "x",
          displayName: name,
        },
      });
    const finish = (userId: string, dailyPuzzleId: string, score: number) =>
      prisma.gameAttempt.create({
        data: { userId, dailyPuzzleId, status: "COMPLETED", won: true, score },
      });
    const both = await player("both"); // finished A and B: a Perfect Day
    const onlyB = await player("onlyb"); // only finished the puzzle that gets deleted
    const onlyA = await player("onlya"); // finished everything that will remain
    await finish(both.id, puzzleA.id, 70);
    await finish(both.id, puzzleB.id, 60);
    await finish(onlyB.id, puzzleB.id, 60);
    await finish(onlyA.id, puzzleA.id, 70);
    await prisma.dailyScore.createMany({
      data: [
        { userId: both.id, date, totalScore: 180, gamesCompleted: 2, isPerfectDay: true },
        { userId: onlyB.id, date, totalScore: 60, gamesCompleted: 1, isPerfectDay: false },
        { userId: onlyA.id, date, totalScore: 70, gamesCompleted: 1, isPerfectDay: false },
      ],
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/puzzles/${puzzleB.id}`,
      cookies: adminCookies,
    });
    expect(res.statusCode).toBe(200);

    const score = (userId: string) =>
      prisma.dailyScore.findUnique({ where: { userId_date: { userId, date } } });
    expect(await score(both.id)).toMatchObject({
      totalScore: 70 + SCORE.PERFECT_DAY_BONUS,
      gamesCompleted: 1,
      isPerfectDay: true,
    });
    expect(await score(onlyB.id)).toBeNull();
    expect(await score(onlyA.id)).toMatchObject({
      totalScore: 70 + SCORE.PERFECT_DAY_BONUS,
      isPerfectDay: true,
    });
  });

  it("lists puzzles newest first, bounded by ?limit", async () => {
    const adminCookies = await registerAndGetCookies("admin5", "ADMIN");
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "M", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const today = getTodayKey("Asia/Kathmandu");
    for (let i = 0; i < 3; i++) {
      await prisma.dailyPuzzle.create({
        data: {
          gameId: game.id,
          date: dateKeyToJSDate(addDaysToKey(today, -i)),
          puzzleNumber: i + 1,
          content: {},
        },
      });
    }
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles?limit=2",
      cookies: adminCookies,
    });
    expect(res.json().data.map((p: { date: string }) => p.date)).toEqual([
      today,
      addDaysToKey(today, -1),
    ]);
  });

  it("locks a played puzzle's content and date, but still lets an admin archive it", async () => {
    const adminCookies = await registerAndGetCookies("admin6", "ADMIN");
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "M", description: "d", icon: "🧪", sortOrder: 0 },
    });
    const today = getTodayKey("Asia/Kathmandu");
    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(today),
        puzzleNumber: 1,
        status: "PUBLISHED",
        content: { a: 1 },
      },
    });
    const edit = (payload: object) =>
      app.inject({
        method: "PUT",
        url: `/api/admin/puzzles/${puzzle.id}`,
        cookies: adminCookies,
        payload,
      });

    expect((await edit({ content: { a: 2 } })).statusCode).toBe(200); // nobody has played it yet

    const player = await prisma.user.create({
      data: { email: "p@example.com", username: "player1", passwordHash: "x", displayName: "P" },
    });
    await prisma.gameAttempt.create({ data: { userId: player.id, dailyPuzzleId: puzzle.id } });

    const contentEdit = await edit({ content: { a: 3 } });
    expect(contentEdit.statusCode).toBe(409);
    expect(contentEdit.json().error.message).toMatch(/played 1 time/);
    expect((await edit({ date: addDaysToKey(today, 1) })).statusCode).toBe(409);
    expect((await edit({ content: { a: 2 } })).statusCode).toBe(200); // re-saving identical content is fine
    expect((await edit({ status: "ARCHIVED" })).statusCode).toBe(200);
    expect(
      (await prisma.dailyPuzzle.findUniqueOrThrow({ where: { id: puzzle.id } })).content,
    ).toEqual({ a: 2 });
  });
});
