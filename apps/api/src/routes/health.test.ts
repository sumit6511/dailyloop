import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerGracefulShutdown } from "../lib/shutdown.js";

describe("health, headers and shutdown", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("reports healthy when the database answers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ status: "ok", database: "ok" });
  });

  it("reports 503 when the database is unreachable", async () => {
    const spy = vi
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("connection refused"));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json().data).toMatchObject({ status: "error", database: "unreachable" });
    spy.mockRestore();
  });

  it("sends baseline security headers on every response, errors included", async () => {
    for (const url of ["/api/health", "/api/games/today", "/api/nope"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.headers["x-content-type-options"], url).toBe("nosniff");
      expect(res.headers["x-frame-options"], url).toBe("DENY");
      expect(res.headers["cache-control"], url).toBe("no-store");
      expect(res.headers["referrer-policy"], url).toBe("no-referrer");
    }
  });

  it("closes the server and the database before exiting on SIGTERM", async () => {
    const order: string[] = [];
    const fakeApp = {
      log: { info: () => {}, error: () => {} },
      close: async () => void order.push("server closed"),
    };
    const shutdown = registerGracefulShutdown(
      fakeApp as unknown as FastifyInstance,
      async () => void order.push("db disconnected"),
      {
        exit: (code) => void order.push(`exit ${code}`),
      },
    );
    await shutdown("SIGTERM");
    await shutdown("SIGTERM"); // a second signal mid-shutdown is ignored
    expect(order).toEqual(["server closed", "db disconnected", "exit 0"]);
  });
});
