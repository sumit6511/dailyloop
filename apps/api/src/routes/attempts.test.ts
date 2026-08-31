import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { getTodayKey, dateKeyToJSDate, addDaysToKey } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const CONNECTIONS_CONTENT = {
  categories: [
    { title: "A", difficulty: 1, words: ["ONE", "TWO", "THREE", "FOUR"] },
    { title: "B", difficulty: 2, words: ["FIVE", "SIX", "SEVEN", "EIGHT"] },
    { title: "C", difficulty: 3, words: ["NINE", "TEN", "ELEVEN", "TWELVE"] },
    { title: "D", difficulty: 4, words: ["RED", "BLUE", "GREEN", "PINK"] },
  ],
  words: [
    "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT",
    "NINE", "TEN", "ELEVEN", "TWELVE", "RED", "BLUE", "GREEN", "PINK",
  ],
};

const WORD_GUESS_CONTENT = { answer: "CRANE" };

const LOGIC_PUZZLE_SOLUTION = [
  [1, 2, 3, 4, 5, 6],
  [4, 5, 6, 1, 2, 3],
  [2, 3, 1, 5, 6, 4],
  [5, 6, 4, 2, 3, 1],
  [3, 1, 2, 6, 4, 5],
  [6, 4, 5, 3, 1, 2],
];
const LOGIC_PUZZLE_CONTENT = {
  solution: LOGIC_PUZZLE_SOLUTION,
  puzzle: LOGIC_PUZZLE_SOLUTION.map((row, r) =>
    row.map((v, c) => ((r === 0 && c === 0) || (r === 5 && c === 5) ? 0 : v)),
  ),
};

describe("attempt lifecycle", () => {
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
    await prisma.dailyScore.deleteMany();
    await prisma.streak.deleteMany();
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
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

  async function publishToday(slug: string, name: string, icon: string, content: unknown) {
    const game = await prisma.game.create({ data: { slug, name, description: "d", icon, sortOrder: 0 } });
    const date = dateKeyToJSDate(getTodayKey("Asia/Kathmandu"));
    await prisma.dailyPuzzle.create({
      data: { gameId: game.id, date, puzzleNumber: 1, status: "PUBLISHED", content: content as Prisma.InputJsonValue },
    });
    return game;
  }

  it("plays Connections start-to-finish, scores it, and rejects further submissions", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);

    const started = await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });
    expect(started.statusCode).toBe(200);
    expect(started.json().data.content.words).toHaveLength(16);

    let lastResponse;
    for (const category of CONNECTIONS_CONTENT.categories) {
      lastResponse = await app.inject({
        method: "POST",
        url: "/api/games/connections/attempts/submit",
        cookies,
        payload: { move: { words: category.words } },
      });
      expect(lastResponse.statusCode).toBe(200);
    }

    const finalBody = lastResponse!.json().data;
    expect(finalBody.complete).toBe(true);
    expect(finalBody.won).toBe(true);
    expect(finalBody.score).toBeGreaterThan(0);

    const retry = await app.inject({
      method: "POST",
      url: "/api/games/connections/attempts/submit",
      cookies,
      payload: { move: { words: CONNECTIONS_CONTENT.categories[0]!.words } },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.alreadyCompleted).toBe(true);
  });

  it("rejects submitting a move before starting the attempt", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);

    const res = await app.inject({
      method: "POST",
      url: "/api/games/connections/attempts/submit",
      cookies,
      payload: { move: { words: CONNECTIONS_CONTENT.categories[0]!.words } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("checks Logic Puzzle progress, flagging wrong cells without revealing the solution", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/start", cookies });

    await app.inject({
      method: "POST",
      url: "/api/games/logic-puzzle/attempts/submit",
      cookies,
      payload: { move: { row: 0, col: 0, value: LOGIC_PUZZLE_SOLUTION[0]![0] } }, // correct
    });
    await app.inject({
      method: "POST",
      url: "/api/games/logic-puzzle/attempts/submit",
      cookies,
      payload: { move: { row: 5, col: 5, value: ((LOGIC_PUZZLE_SOLUTION[5]![5]! % 6) + 1) } }, // wrong
    });

    const res = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/check", cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(JSON.stringify(body)).not.toContain(String(LOGIC_PUZZLE_SOLUTION[5]![5]));
    expect(body.cells.find((c: { row: number; col: number }) => c.row === 0 && c.col === 0)?.correct).toBe(true);
    expect(body.cells.find((c: { row: number; col: number }) => c.row === 5 && c.col === 5)?.correct).toBe(false);
  });

  it("rejects checking progress for a game that doesn't support it", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/connections/attempts/check", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("rejects checking progress before starting the attempt", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);

    const res = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/check", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid Word Guess move (not a dictionary word) without consuming a guess", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });

    const res = await app.inject({
      method: "POST",
      url: "/api/games/word-guess/attempts/submit",
      cookies,
      payload: { move: { guess: "ZZZZZ" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("wins Word Guess and awards a score", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });

    const wrong = await app.inject({
      method: "POST",
      url: "/api/games/word-guess/attempts/submit",
      cookies,
      payload: { move: { guess: "STORM" } },
    });
    expect(wrong.json().data.complete).toBe(false);

    const right = await app.inject({
      method: "POST",
      url: "/api/games/word-guess/attempts/submit",
      cookies,
      payload: { move: { guess: "CRANE" } },
    });
    expect(right.json().data).toMatchObject({ complete: true, won: true });
    expect(right.json().data.score).toBeGreaterThan(0);
  });

  it("awards the Perfect Day bonus only once every published game is completed", async () => {
    const { userId, cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);

    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });
    for (const category of CONNECTIONS_CONTENT.categories) {
      await app.inject({
        method: "POST",
        url: "/api/games/connections/attempts/submit",
        cookies,
        payload: { move: { words: category.words } },
      });
    }

    const midway = await prisma.dailyScore.findFirst({ where: { userId } });
    expect(midway?.isPerfectDay).toBe(false);

    await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });
    await app.inject({
      method: "POST",
      url: "/api/games/word-guess/attempts/submit",
      cookies,
      payload: { move: { guess: "CRANE" } },
    });

    const final = await prisma.dailyScore.findFirst({ where: { userId } });
    expect(final?.isPerfectDay).toBe(true);
    expect(final?.gamesCompleted).toBe(2);
    // Perfect day bonus (50) should be baked into the total on top of both games' raw scores.
    const attempts = await prisma.gameAttempt.findMany({ where: { userId } });
    const rawSum = attempts.reduce((sum, a) => sum + a.score, 0);
    expect(final?.totalScore).toBe(rawSum + 50);
  });

  it("advances the streak by one on a consecutive day, and resets to 1 after a gap", async () => {
    const { userId, cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    const todayKey = getTodayKey("Asia/Kathmandu");

    await prisma.streak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -1)),
      },
      update: {
        currentStreak: 5,
        longestStreak: 5,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -1)),
      },
    });

    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });
    for (const category of CONNECTIONS_CONTENT.categories) {
      await app.inject({
        method: "POST",
        url: "/api/games/connections/attempts/submit",
        cookies,
        payload: { move: { words: category.words } },
      });
    }

    const afterConsecutive = await prisma.streak.findUnique({ where: { userId } });
    expect(afterConsecutive?.currentStreak).toBe(6);
    expect(afterConsecutive?.longestStreak).toBe(6);
  });

  it("resets the streak to 1 after a gap of more than one day", async () => {
    const { userId, cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    const todayKey = getTodayKey("Asia/Kathmandu");

    await prisma.streak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -3)),
      },
      update: {
        currentStreak: 5,
        longestStreak: 5,
        lastCompletedDate: dateKeyToJSDate(addDaysToKey(todayKey, -3)),
      },
    });

    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });
    for (const category of CONNECTIONS_CONTENT.categories) {
      await app.inject({
        method: "POST",
        url: "/api/games/connections/attempts/submit",
        cookies,
        payload: { move: { words: category.words } },
      });
    }

    const afterGap = await prisma.streak.findUnique({ where: { userId } });
    expect(afterGap?.currentStreak).toBe(1);
    expect(afterGap?.longestStreak).toBe(5); // longest is untouched by a reset
  });
});
