import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("users", () => {
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

  it("PATCH /me/password changes the password and logs out all sessions", async () => {
    const { userId, cookies } = await registerUser("harry");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/password",
      cookies,
      payload: { currentPassword: "correct-horse-battery", newPassword: "a-new-strong-password" },
    });
    expect(res.statusCode).toBe(200);

    const sessions = await prisma.session.count({ where: { userId } });
    expect(sessions).toBe(0);

    // The old session cookie no longer authenticates.
    const meRes = await app.inject({ method: "GET", url: "/api/auth/me", cookies });
    expect(meRes.statusCode).toBe(401);

    // Can log in with the new password.
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { emailOrUsername: "harry", password: "a-new-strong-password" },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it("PATCH /me/password rejects an incorrect current password", async () => {
    const { cookies } = await registerUser("harry");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/password",
      cookies,
      payload: { currentPassword: "wrong-password", newPassword: "a-new-strong-password" },
    });
    expect(res.statusCode).toBe(400);
  });
});
