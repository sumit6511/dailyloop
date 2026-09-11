import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, addDaysToKey, dateKeyToJSDate } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { isAuthorizedCronRequest } from "../lib/cron-auth.js";

describe("isAuthorizedCronRequest", () => {
  it("rejects when the secret itself is unset", () => {
    expect(isAuthorizedCronRequest("Bearer anything", undefined)).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(isAuthorizedCronRequest(undefined, "the-secret")).toBe(false);
  });

  it("rejects a header that isn't a Bearer token, or the wrong token", () => {
    expect(isAuthorizedCronRequest("the-secret", "the-secret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer wrong", "the-secret")).toBe(false);
  });

  it("accepts the correct Bearer token", () => {
    expect(isAuthorizedCronRequest("Bearer the-secret", "the-secret")).toBe(true);
  });
});

describe("POST /api/cron/generate-tomorrow", () => {
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
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
  });

  it("401s without a bearer token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/cron/generate-tomorrow" });
    expect(res.statusCode).toBe(401);
  });

  it("401s with the wrong token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/cron/generate-tomorrow",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("generates a SCHEDULED (not PUBLISHED) puzzle for tomorrow, for every enabled game", async () => {
    await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });
    await prisma.game.create({
      data: { slug: "disabled-game", name: "Disabled", description: "d", icon: "❌", sortOrder: 1, isEnabled: false },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/cron/generate-tomorrow",
      headers: { authorization: "Bearer test-only-cron-secret-00000000000000000000000000000000" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.results).toEqual([{ gameSlug: "word-guess", result: "created" }]);

    const tomorrowKey = addDaysToKey(getTodayKey("Asia/Kathmandu"), 1);
    const puzzle = await prisma.dailyPuzzle.findFirst({ where: { game: { slug: "word-guess" } } });
    expect(puzzle?.status).toBe("SCHEDULED");
    expect(puzzle?.date).toEqual(dateKeyToJSDate(tomorrowKey));
  });
});
