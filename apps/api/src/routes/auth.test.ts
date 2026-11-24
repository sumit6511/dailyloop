import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { parseTrustProxy } from "../lib/trust-proxy.js";
import { SESSION_TOUCH_INTERVAL_MS } from "../lib/session.js";
import { loginThrottle, MAX_FAILURES } from "../lib/login-throttle.js";

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
    loginThrottle.reset();
    await prisma.passwordResetToken.deleteMany();
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
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registerPayload,
    });
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

  it("treats usernames as case-insensitive: no case-variant duplicates, any case resolves", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });

    const variant = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registerPayload, username: "HaRRy", email: "other@example.com" },
    });
    expect(variant.statusCode).toBe(409);

    const original = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { emailOrUsername: "harry", password: registerPayload.password },
    });
    const session = original.cookies.find((c) => c.name === "dp_session")!;
    const profile = await app.inject({
      method: "GET",
      url: "/api/users/HARRY",
      cookies: { [session.name]: session.value },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().data.username).toBe("harry"); // stored casing is preserved
  });

  it("logs in regardless of the casing of the email or username", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    for (const emailOrUsername of ["Harry@Example.COM", "HARRY", "harry"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername, password: registerPayload.password },
      });
      expect(res.statusCode, emailOrUsername).toBe(200);
    }
  });

  it("answers simultaneous registrations for the same username with one 201 and 409s, never a 500", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { ...registerPayload, email: `harry${i}@example.com` },
        }),
      ),
    );
    const codes = responses.map((r) => r.statusCode).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409]);
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
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registerPayload,
    });
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
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registerPayload,
    });
    const cookie = registerRes.cookies.find((c) => c.name === "dp_session")!;

    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { [cookie.name]: cookie.value },
    });

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

  describe("client IP behind a proxy", () => {
    it("ignores X-Forwarded-For entries a client prepends itself (one trusted hop by default)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: registerPayload,
        headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, // spoofed, then what the proxy saw
      });
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: res.json().data.id },
      });
      expect(session.ip).toBe("203.0.113.9");
    });

    it("parses TRUST_PROXY", () => {
      expect(parseTrustProxy("true")).toBe(true);
      expect(parseTrustProxy("false")).toBe(false);
      expect(parseTrustProxy("0")).toBe(false);
      const twoHops = parseTrustProxy("2") as (addr: string, hop: number) => boolean;
      expect([0, 1, 2].map((hop) => twoHops("10.0.0.1", hop))).toEqual([true, true, false]);
      const byDefault = parseTrustProxy(undefined) as (addr: string, hop: number) => boolean;
      expect([0, 1].map((hop) => byDefault("10.0.0.1", hop))).toEqual([true, false]);
      expect(() => parseTrustProxy("lots")).toThrow();
    });
  });

  it("takes about as long to reject an unknown account as a wrong password", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    const timeLogin = async (emailOrUsername: string) => {
      const start = performance.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername, password: "wrong-password-123" },
      });
      expect(res.statusCode).toBe(400);
      return performance.now() - start;
    };
    await timeLogin("nobody-warmup"); // first unknown-user login also builds the throwaway hash
    const known = Math.min(await timeLogin("harry"), await timeLogin("harry"));
    const unknown = Math.min(await timeLogin("nobody"), await timeLogin("nobody"));
    // Without the dummy verification an unknown user returns in ~1ms vs ~50ms+ for Argon2.
    expect(unknown).toBeGreaterThan(known * 0.5);
  });

  describe("password reset", () => {
    const RAW = "a".repeat(64);
    const hashOf = (raw: string) => createHash("sha256").update(raw).digest("hex");
    const seedToken = async (userId: string, raw = RAW) =>
      prisma.passwordResetToken.create({
        data: { userId, tokenHash: hashOf(raw), expiresAt: new Date(Date.now() + 3_600_000) },
      });
    const confirm = (token: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/password-reset/confirm",
        payload: { token, newPassword: "brand-new-password" },
      });
    const register = async () =>
      (
        await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload })
      ).json().data.id as string;

    it("resets the password once with a valid link, then refuses to reuse it", async () => {
      await seedToken(await register());
      expect((await confirm(RAW)).statusCode).toBe(200);
      expect((await confirm(RAW)).statusCode).toBe(400);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername: "harry", password: "brand-new-password" },
      });
      expect(login.statusCode).toBe(200);
    });

    it("revokes an earlier link when a new one is requested", async () => {
      await seedToken(await register());
      await app.inject({
        method: "POST",
        url: "/api/auth/password-reset/request",
        payload: { email: registerPayload.email },
      });
      expect((await confirm(RAW)).statusCode).toBe(400);
    });

    it("revokes outstanding links when the password is changed from settings", async () => {
      const userId = await register();
      await seedToken(userId);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername: "harry", password: registerPayload.password },
      });
      const cookie = login.cookies.find((c) => c.name === "dp_session")!;
      const change = await app.inject({
        method: "PATCH",
        url: "/api/users/me/password",
        cookies: { [cookie.name]: cookie.value },
        payload: { currentPassword: registerPayload.password, newPassword: "another-new-password" },
      });
      expect(change.statusCode).toBe(200);
      expect((await confirm(RAW)).statusCode).toBe(400);
    });
  });

  it("only accepts an https avatar URL (or empty to clear it)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registerPayload,
    });
    const cookie = res.cookies.find((c) => c.name === "dp_session")!;
    const update = (avatarUrl: string) =>
      app.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { [cookie.name]: cookie.value },
        payload: { avatarUrl },
      });
    expect((await update("javascript:alert(1)")).statusCode).toBe(400);
    expect((await update("http://example.com/a.png")).statusCode).toBe(400);
    expect((await update("https://example.com/a.png")).statusCode).toBe(200);
    expect((await update("")).statusCode).toBe(200);
  });

  it("slides a session's expiry at most every few minutes, not on every request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registerPayload,
    });
    const cookie = res.cookies.find((c) => c.name === "dp_session")!;
    const me = () =>
      app.inject({ method: "GET", url: "/api/auth/me", cookies: { [cookie.name]: cookie.value } });
    const session = () =>
      prisma.session.findFirstOrThrow({ where: { userId: res.json().data.id } });

    const before = await session();
    await me();
    await me();
    await new Promise((r) => setTimeout(r, 50)); // let any fire-and-forget write land
    expect((await session()).lastUsedAt).toEqual(before.lastUsedAt);

    const stale = new Date(Date.now() - SESSION_TOUCH_INTERVAL_MS - 1_000);
    await prisma.session.update({ where: { id: before.id }, data: { lastUsedAt: stale } });
    await me();
    await new Promise((r) => setTimeout(r, 50));
    expect((await session()).lastUsedAt.getTime()).toBeGreaterThan(stale.getTime());
  });

  describe("per-account login throttle", () => {
    const login = (emailOrUsername: string, password: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername, password },
      });

    it("refuses even the right password after too many failures for that account", async () => {
      await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
      for (let i = 0; i < MAX_FAILURES; i++)
        expect((await login("harry", "wrong-password")).statusCode).toBe(400);
      const locked = await login("HARRY", registerPayload.password);
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error.code).toBe("TOO_MANY_ATTEMPTS");
      expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("locks an unknown identifier the same way, so the lockout reveals nothing", async () => {
      for (let i = 0; i < MAX_FAILURES; i++) await login("nobody-here", "wrong-password");
      expect((await login("nobody-here", "anything")).statusCode).toBe(429);
    });

    it("forgets earlier failures after a successful sign-in", async () => {
      await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
      for (let i = 0; i < MAX_FAILURES - 1; i++) await login("harry", "wrong-password");
      expect((await login("harry", registerPayload.password)).statusCode).toBe(200);
      expect((await login("harry", "wrong-password")).statusCode).toBe(400); // counting from zero again
      expect((await login("harry", registerPayload.password)).statusCode).toBe(200);
    });
  });

  it("requires login to view a profile or its achievements", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: registerPayload });
    expect((await app.inject({ method: "GET", url: "/api/users/harry" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/api/users/harry/achievements" })).statusCode,
    ).toBe(401);
  });
});
