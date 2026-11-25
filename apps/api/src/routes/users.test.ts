import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { loginThrottle } from "../lib/login-throttle.js";
import { addDaysToKey, dateKeyToJSDate, getTodayKey, ACTIVITY_DAYS } from "@dailyloop/shared";

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
    loginThrottle.reset();
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

  describe("DELETE /me", () => {
    const deleteMe = (cookies: Record<string, string>, password: string) =>
      app.inject({ method: "DELETE", url: "/api/users/me", cookies, payload: { password } });

    it("needs the correct password", async () => {
      const { userId, cookies } = await registerUser("harry");

      expect((await deleteMe(cookies, "wrong-password")).statusCode).toBe(400);
      const missing = await app.inject({ method: "DELETE", url: "/api/users/me", cookies });
      expect(missing.statusCode).toBe(400);
      expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
    });

    it("removes the account and everything personal to it, and nobody else's", async () => {
      const harry = await registerUser("harry");
      const ron = await registerUser("ron");
      const [userAId, userBId] = [harry.userId, ron.userId].sort() as [string, string];
      await prisma.friendship.create({ data: { userAId, userBId } });

      const res = await deleteMe(harry.cookies, "correct-horse-battery");
      expect(res.statusCode).toBe(200);
      expect(res.cookies.find((c) => c.name === "dp_session")?.value).toBe("");

      expect(await prisma.user.count({ where: { id: harry.userId } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: harry.userId } })).toBe(0);
      expect(await prisma.streak.count({ where: { userId: harry.userId } })).toBe(0);
      expect(await prisma.friendship.count()).toBe(0);

      // The old cookie is dead and the credentials no longer log in...
      expect(
        (await app.inject({ method: "GET", url: "/api/auth/me", cookies: harry.cookies }))
          .statusCode,
      ).toBe(401);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { emailOrUsername: "harry", password: "correct-horse-battery" },
      });
      expect(login.statusCode).toBe(400);

      // ...while the friend is untouched, and the username is free again.
      expect(
        (await app.inject({ method: "GET", url: "/api/auth/me", cookies: ron.cookies })).statusCode,
      ).toBe(200);
      await registerUser("harry");
      expect(await prisma.user.count({ where: { username: "harry" } })).toBe(1);
    });

    it("won't remove the only admin", async () => {
      const admin = await registerUser("dumbledore");
      await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMIN" } });

      const refused = await deleteMe(admin.cookies, "correct-horse-battery");
      expect(refused.statusCode).toBe(409);
      expect(await prisma.user.count({ where: { id: admin.userId } })).toBe(1);

      const other = await registerUser("mcgonagall");
      await prisma.user.update({ where: { id: other.userId }, data: { role: "ADMIN" } });
      expect((await deleteMe(admin.cookies, "correct-horse-battery")).statusCode).toBe(200);
    });
  });

  describe("GET /:username/activity", () => {
    it("returns the last 12 weeks, one entry per day, zeros where nothing was played", async () => {
      const { userId, cookies } = await registerUser("harry");
      const today = getTodayKey();
      const score = (daysAgo: number, totalScore: number, isPerfectDay = false) =>
        prisma.dailyScore.create({
          data: {
            userId,
            date: dateKeyToJSDate(addDaysToKey(today, -daysAgo)),
            totalScore,
            gamesCompleted: Math.ceil(totalScore / 100),
            isPerfectDay,
          },
        });
      await score(0, 650, true);
      await score(3, 120);
      await score(ACTIVITY_DAYS, 999); // one day too old to show

      const res = await app.inject({ method: "GET", url: "/api/users/harry/activity", cookies });
      expect(res.statusCode).toBe(200);
      const { from, to, days } = res.json().data;
      expect(days).toHaveLength(ACTIVITY_DAYS);
      expect(to).toBe(today);
      expect(from).toBe(addDaysToKey(today, -(ACTIVITY_DAYS - 1)));
      expect(days.at(-1)).toEqual({
        date: today,
        points: 650,
        gamesCompleted: 7,
        perfectDay: true,
      });
      expect(days.at(-4)).toMatchObject({ points: 120, perfectDay: false });
      expect(days.reduce((sum: number, d: { points: number }) => sum + d.points, 0)).toBe(770);
    });

    it("needs a login, and 404s for an unknown player", async () => {
      const { cookies } = await registerUser("harry");
      expect(
        (await app.inject({ method: "GET", url: "/api/users/harry/activity" })).statusCode,
      ).toBe(401);
      expect(
        (await app.inject({ method: "GET", url: "/api/users/nobody/activity", cookies }))
          .statusCode,
      ).toBe(404);
    });
  });
});
