import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey } from "@dailyloop/shared";
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

    const nonAdmin = await app.inject({ method: "GET", url: "/api/admin/puzzles", cookies: userCookies });
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
      payload: { gameSlug: "mock-game", date: dateKey, content: { words: ["a", "b"] }, status: "SCHEDULED" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json().data;
    expect(body.puzzleNumber).toBe(1);
    const puzzleId = body.id as string;

    const listed = await app.inject({ method: "GET", url: "/api/admin/puzzles", cookies: adminCookies });
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

    const listedAfter = await app.inject({ method: "GET", url: "/api/admin/puzzles", cookies: adminCookies });
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

    const first = await app.inject({ method: "POST", url: "/api/admin/puzzles", cookies: adminCookies, payload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: "POST", url: "/api/admin/puzzles", cookies: adminCookies, payload });
    expect(second.statusCode).toBe(409);
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
});
