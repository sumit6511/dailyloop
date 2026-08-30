import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("auth routes", () => {
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
    await prisma.session.deleteMany();
    await prisma.streak.deleteMany();
    await prisma.user.deleteMany();
  });

  const registerPayload = {
    email: "harry@example.com",
    username: "harry",
    password: "correct-horse-battery",
    displayName: "Harry",
  };

  it("registers a new user, creates a streak row, and sets a session cookie", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.username).toBe("harry");
    expect(body.data.passwordHash).toBeUndefined();
    expect(response.cookies.some((c) => c.name === "dp_session")).toBe(true);

    const streak = await prisma.streak.findUnique({ where: { userId: body.data.id } });
    expect(streak).not.toBeNull();
  });

  it("rejects registration with a duplicate email or username", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });

    const dupeEmail = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registerPayload, username: "harry2" },
    });
    expect(dupeEmail.statusCode).toBe(409);

    const dupeUsername = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registerPayload, email: "harry2@example.com" },
    });
    expect(dupeUsername.statusCode).toBe(409);
  });

  it("rejects a reserved username", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registerPayload, username: "admin" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });

    const good = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { emailOrUsername: "harry", password: registerPayload.password },
    });
    expect(good.statusCode).toBe(200);

    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { emailOrUsername: "harry", password: "wrong-password" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("returns the current user from /auth/me when authenticated, 401 otherwise", async () => {
    const registerRes = await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    const cookie = registerRes.cookies.find((c) => c.name === "dp_session")!;

    const authed = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [cookie.name]: cookie.value },
    });
    expect(authed.statusCode).toBe(200);
    expect(authed.json().data.email).toBe(registerPayload.email);

    const anon = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(anon.statusCode).toBe(401);
  });

  it("logs out and invalidates the session", async () => {
    const registerRes = await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    const cookie = registerRes.cookies.find((c) => c.name === "dp_session")!;

    await app.inject({ method: "POST", url: "/api/auth/logout", cookies: { [cookie.name]: cookie.value } });

    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [cookie.name]: cookie.value },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it("blocks a cross-origin mutating request but allows requests with no Origin header", async () => {
    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "https://evil.example.com" },
      payload: { emailOrUsername: "harry", password: "whatever" },
    });
    expect(blocked.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:5173" },
      payload: { emailOrUsername: "harry", password: "whatever" },
    });
    expect(allowed.statusCode).not.toBe(403);
  });
});
