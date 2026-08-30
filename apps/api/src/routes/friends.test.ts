import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTodayKey, dateKeyToJSDate } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("friends", () => {
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
    await prisma.friendRequest.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.dailyScore.deleteMany();
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
    return { userId: res.json().data.id as string, cookies: { [cookie.name]: cookie.value } };
  }

  it("sends, lists, and accepts a friend request, forming a mutual friendship", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");

    const sent = await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    expect(sent.statusCode).toBe(201);

    const sumitIncoming = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: sumit.cookies });
    expect(sumitIncoming.json().data.incoming).toHaveLength(1);
    const requestId = sumitIncoming.json().data.incoming[0].id;

    const accepted = await app.inject({
      method: "POST",
      url: `/api/friends/requests/${requestId}/accept`,
      cookies: sumit.cookies,
    });
    expect(accepted.statusCode).toBe(200);

    const harryFriends = await app.inject({ method: "GET", url: "/api/friends", cookies: harry.cookies });
    expect(harryFriends.json().data.map((u: { username: string }) => u.username)).toEqual(["sumit"]);

    const sumitFriends = await app.inject({ method: "GET", url: "/api/friends", cookies: sumit.cookies });
    expect(sumitFriends.json().data.map((u: { username: string }) => u.username)).toEqual(["harry"]);
  });

  it("rejects a request, and the sender can send a fresh one afterward", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");

    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    const incoming1 = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: sumit.cookies });
    const requestId = incoming1.json().data.incoming[0].id;

    const rejected = await app.inject({
      method: "POST",
      url: `/api/friends/requests/${requestId}/reject`,
      cookies: sumit.cookies,
    });
    expect(rejected.statusCode).toBe(200);

    const retry = await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    expect(retry.statusCode).toBe(201);

    const incoming2 = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: sumit.cookies });
    expect(incoming2.json().data.incoming).toHaveLength(1);
  });

  it("auto-accepts instead of duplicating when both users request each other", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");

    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    // Sumit sends one back before responding — should just accept harry's, not create a duplicate.
    const second = await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: sumit.cookies,
      payload: { username: "harry" },
    });
    expect(second.statusCode).toBe(201);

    const harryFriends = await app.inject({ method: "GET", url: "/api/friends", cookies: harry.cookies });
    expect(harryFriends.json().data).toHaveLength(1);

    const pending = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: harry.cookies });
    expect(pending.json().data.incoming).toHaveLength(0);
    expect(pending.json().data.outgoing).toHaveLength(0);
  });

  it("rejects sending a request to yourself, and rejects duplicate/already-friends requests", async () => {
    const harry = await registerUser("harry");
    await registerUser("sumit");

    const toSelf = await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "harry" },
    });
    expect(toSelf.statusCode).toBe(400);

    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("removes a friendship so both sides no longer see each other as friends", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");
    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    const incoming = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: sumit.cookies });
    await app.inject({
      method: "POST",
      url: `/api/friends/requests/${incoming.json().data.incoming[0].id}/accept`,
      cookies: sumit.cookies,
    });

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/friends/${sumit.userId}`,
      cookies: harry.cookies,
    });
    expect(removed.statusCode).toBe(200);

    const harryFriends = await app.inject({ method: "GET", url: "/api/friends", cookies: harry.cookies });
    expect(harryFriends.json().data).toHaveLength(0);
    const sumitFriends = await app.inject({ method: "GET", url: "/api/friends", cookies: sumit.cookies });
    expect(sumitFriends.json().data).toHaveLength(0);
  });

  it("reports the correct relationship status on a public profile", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");

    const none = await app.inject({ method: "GET", url: "/api/users/sumit", cookies: harry.cookies });
    expect(none.json().data.relationship).toBe("none");

    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    const sent = await app.inject({ method: "GET", url: "/api/users/sumit", cookies: harry.cookies });
    expect(sent.json().data.relationship).toBe("request_sent");
    const received = await app.inject({ method: "GET", url: "/api/users/harry", cookies: sumit.cookies });
    expect(received.json().data.relationship).toBe("request_received");

    const self = await app.inject({ method: "GET", url: "/api/users/harry", cookies: harry.cookies });
    expect(self.json().data.relationship).toBe("self");
  });

  it("searches users by username or display name, excluding the current user", async () => {
    const harry = await registerUser("harry");
    await registerUser("sumit");

    const res = await app.inject({ method: "GET", url: "/api/users/search?q=sum", cookies: harry.cookies });
    expect(res.json().data.map((u: { username: string }) => u.username)).toEqual(["sumit"]);

    const self = await app.inject({ method: "GET", url: "/api/users/search?q=harry", cookies: harry.cookies });
    expect(self.json().data).toHaveLength(0);
  });

  it("scopes the friends leaderboard to the caller plus their friends only", async () => {
    const harry = await registerUser("harry");
    const sumit = await registerUser("sumit");
    const outsider = await registerUser("aayush");

    await app.inject({
      method: "POST",
      url: "/api/friends/requests",
      cookies: harry.cookies,
      payload: { username: "sumit" },
    });
    const incoming = await app.inject({ method: "GET", url: "/api/friends/requests", cookies: sumit.cookies });
    await app.inject({
      method: "POST",
      url: `/api/friends/requests/${incoming.json().data.incoming[0].id}/accept`,
      cookies: sumit.cookies,
    });

    const today = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    await prisma.dailyScore.create({ data: { userId: harry.userId, date: today, totalScore: 50, gamesCompleted: 1 } });
    await prisma.dailyScore.create({ data: { userId: sumit.userId, date: today, totalScore: 80, gamesCompleted: 1 } });
    await prisma.dailyScore.create({ data: { userId: outsider.userId, date: today, totalScore: 999, gamesCompleted: 1 } });

    const res = await app.inject({
      method: "GET",
      url: "/api/leaderboard/friends?range=daily",
      cookies: harry.cookies,
    });
    const usernames = res.json().data.map((e: { username: string }) => e.username);
    expect(usernames).toEqual(["sumit", "harry"]);
    expect(usernames).not.toContain("aayush");
  });
});
