import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { getTodayKey, dateKeyToJSDate, addDaysToKey, SCORE, ACTIVE_TIME } from "@dailyloop/shared";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { activity } from "../services/attempts.js";

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

const NUMBER_PUZZLE_CONTENT = { numbers: [11, 12, 11, 4], target: 23 };

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

  it("gets a Logic Puzzle hint, suggesting a legal cell without revealing the rest of the solution", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/hint", cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.hint).toMatchObject({ row: 0, col: 0, value: LOGIC_PUZZLE_SOLUTION[0]![0], kind: "place" });
    expect(body.hintsUsed).toBe(1);
    // The other blank's solved value shouldn't leak just because a hint was requested.
    expect(JSON.stringify(body.hint)).not.toContain(String(LOGIC_PUZZLE_SOLUTION[5]![5]));
  });

  it("charges each distinct hint once, and the charges lower the final score", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/start", cookies });
    const askForHint = async () =>
      (await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/hint", cookies })).json().data;
    const play = (move: { row: number; col: number; value: number }) =>
      app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/submit", cookies, payload: { move } });

    const first = await askForHint();
    expect(first.hintsUsed).toBe(1);
    expect((await askForHint()).hintsUsed).toBe(1); // same suggestion again (e.g. after dismissing it) is free

    await play(first.hint);
    const second = await askForHint();
    expect(second.hint).toMatchObject({ row: 5, col: 5 });
    expect(second.hintsUsed).toBe(2);

    const today = await app.inject({ method: "GET", url: "/api/games/logic-puzzle/today", cookies });
    expect(today.json().data.hintsUsed).toBe(2);

    const done = (await play(second.hint)).json().data;
    expect(done.complete).toBe(true);
    const attempt = await prisma.gameAttempt.findFirstOrThrow({ where: { status: "COMPLETED" } });
    const breakdown = attempt.scoreBreakdown as { hintPenalty: number; accuracyBonus: number };
    expect(breakdown.hintPenalty).toBe(2 * SCORE.HINT_PENALTY);
    expect(breakdown.accuracyBonus).toBe(0);

    const afterwards = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/hint", cookies });
    expect(afterwards.statusCode).toBe(400);
  });

  it("charges only once when the same hint is requested concurrently", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/start", cookies });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/hint", cookies })),
    );
    for (const res of responses) expect(res.statusCode).toBe(200);
    const attempt = await prisma.gameAttempt.findFirstOrThrow();
    expect(attempt.hintsUsed).toBe(1);
  });

  it("rejects checking progress for a game that doesn't support it", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/connections/attempts/check", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a hint request for a game that doesn't support it", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/connections/attempts/hint", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a hint request before starting the attempt", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);

    const res = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/hint", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("undoes the last Number Puzzle move, restoring the pool to before that combine", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("number-puzzle", "Number Puzzle", "🔢", NUMBER_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/number-puzzle/attempts/start", cookies });

    const combined = await app.inject({
      method: "POST",
      url: "/api/games/number-puzzle/attempts/submit",
      cookies,
      payload: { move: { type: "combine", a: 11, b: 12, op: "+" } },
    });
    expect(combined.json().data.content.pool).toEqual([11, 4, 23]);

    const undone = await app.inject({ method: "POST", url: "/api/games/number-puzzle/attempts/undo", cookies });
    expect(undone.statusCode).toBe(200);
    expect(undone.json().data.content.pool.sort()).toEqual([4, 11, 11, 12].sort());
  });

  it("rejects undo for a game that doesn't support it, even mid-attempt", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("connections", "Connections", "🟩", CONNECTIONS_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/connections/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/connections/attempts/undo", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("rejects undo when there's nothing to undo yet", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("number-puzzle", "Number Puzzle", "🔢", NUMBER_PUZZLE_CONTENT);
    await app.inject({ method: "POST", url: "/api/games/number-puzzle/attempts/start", cookies });

    const res = await app.inject({ method: "POST", url: "/api/games/number-puzzle/attempts/undo", cookies });
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
  describe("concurrent requests", () => {
    const submit = (cookies: Record<string, string>, guess: string) =>
      app.inject({ method: "POST", url: "/api/games/word-guess/attempts/submit", cookies, payload: { move: { guess } } });

    it("records every move when several are submitted at once", async () => {
      const { cookies } = await registerUser("harry");
      await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);
      await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });

      const responses = await Promise.all(["STORM", "PLANT", "MOUSE", "BRICK"].map((g) => submit(cookies, g)));
      for (const res of responses) expect(res.statusCode).toBe(200);

      const attempt = await prisma.gameAttempt.findFirstOrThrow();
      expect((attempt.attemptLog as unknown[]).length).toBe(4);
      expect(attempt.mistakeCount).toBe(4);
    });

    it("completes the attempt exactly once when the winning move races itself, keeping the streak", async () => {
      const { userId, cookies } = await registerUser("harry");
      await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);
      const yesterday = dateKeyToJSDate(addDaysToKey(getTodayKey("Asia/Kathmandu"), -1));
      await prisma.streak.upsert({
        where: { userId },
        create: { userId, currentStreak: 5, longestStreak: 5, lastCompletedDate: yesterday },
        update: { currentStreak: 5, longestStreak: 5, lastCompletedDate: yesterday },
      });
      await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });

      const responses = await Promise.all(Array.from({ length: 4 }, () => submit(cookies, "CRANE")));
      for (const res of responses) expect(res.statusCode).toBe(200);
      expect(responses.filter((r) => r.json().data.score != null && !r.json().data.alreadyCompleted)).toHaveLength(1);

      const attempt = await prisma.gameAttempt.findFirstOrThrow();
      expect(attempt.status).toBe("COMPLETED");
      expect(attempt.attemptLog).toEqual([{ guess: "CRANE" }]);
      expect((await prisma.streak.findUniqueOrThrow({ where: { userId } })).currentStreak).toBe(6);
      expect((await prisma.dailyScore.findFirstOrThrow({ where: { userId } })).gamesCompleted).toBe(1);
    });

    it("creates a single attempt when start is called several times at once", async () => {
      const { cookies } = await registerUser("harry");
      await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);

      const responses = await Promise.all(
        Array.from({ length: 4 }, () => app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies })),
      );
      for (const res of responses) expect(res.statusCode).toBe(200);
      expect(await prisma.gameAttempt.count()).toBe(1);
    });
  });
  describe("active play time", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("scores Logic Puzzle on time actually spent on the puzzle, not time away", async () => {
      const { cookies } = await registerUser("harry");
      await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
      // Fake only Date — real timers keep Fastify and Prisma working.
      const t0 = Date.now();
      vi.useFakeTimers({ toFake: ["Date"], now: t0 });
      const at = (ms: number) => vi.setSystemTime(t0 + ms);
      const heartbeat = async () =>
        (await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/heartbeat", cookies })).json().data;
      const play = (row: number, col: number) =>
        app.inject({
          method: "POST",
          url: "/api/games/logic-puzzle/attempts/submit",
          cookies,
          payload: { move: { row, col, value: LOGIC_PUZZLE_SOLUTION[row]![col] } },
        });

      await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/start", cookies });
      at(10_000);
      expect((await heartbeat()).activeMs).toBe(10_000);
      at(20_000);
      expect((await heartbeat()).activeMs).toBe(20_000);
      at(20_000 + 10 * 60_000); // left the page for ten minutes
      expect((await heartbeat()).activeMs).toBe(20_000);
      at(35_000 + 10 * 60_000);
      await play(0, 0);
      const today = await app.inject({ method: "GET", url: "/api/games/logic-puzzle/today", cookies });
      expect(today.json().data.activeMs).toBe(35_000);
      at(40_000 + 10 * 60_000);
      expect((await play(5, 5)).json().data.complete).toBe(true);

      const attempt = await prisma.gameAttempt.findFirstOrThrow();
      expect(attempt.durationMs).toBe(40_000);
      expect((await heartbeat()).complete).toBe(true);
    });

    it("rejects a heartbeat before the attempt has started", async () => {
      const { cookies } = await registerUser("harry");
      await publishToday("logic-puzzle", "Logic Puzzle", "🧠", LOGIC_PUZZLE_CONTENT);
      const res = await app.inject({ method: "POST", url: "/api/games/logic-puzzle/attempts/heartbeat", cookies });
      expect(res.statusCode).toBe(400);
    });

    it("credits a gap only up to the away threshold", () => {
      const last = new Date(1_000_000);
      const after = (ms: number) => activity({ activeMs: 500, lastActiveAt: last }, new Date(last.getTime() + ms)).activeMs;
      expect(after(ACTIVE_TIME.MAX_GAP_MS)).toBe(500 + ACTIVE_TIME.MAX_GAP_MS);
      expect(after(ACTIVE_TIME.MAX_GAP_MS + 1)).toBe(500);
      expect(after(-5_000)).toBe(500); // clock skew never subtracts time
      expect(activity({ activeMs: 0, lastActiveAt: null }, last).activeMs).toBe(0);
    });
  });

  it("reports per-game stats and the Word Guess distribution in /me/stats", async () => {
    const { cookies } = await registerUser("harry");
    await publishToday("word-guess", "Word Guess", "🟨", WORD_GUESS_CONTENT);
    await publishToday("number-puzzle", "Number Puzzle", "🔢", NUMBER_PUZZLE_CONTENT);
    const play = (slug: string, move: unknown) =>
      app.inject({ method: "POST", url: `/api/games/${slug}/attempts/submit`, cookies, payload: { move } });

    await app.inject({ method: "POST", url: "/api/games/word-guess/attempts/start", cookies });
    await play("word-guess", { guess: "STORM" });
    await play("word-guess", { guess: "CRANE" }); // won in 2
    await app.inject({ method: "POST", url: "/api/games/number-puzzle/attempts/start", cookies });
    await play("number-puzzle", { type: "submit" }); // gave up: a loss

    const res = await app.inject({ method: "GET", url: "/api/me/stats", cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    const bySlug = Object.fromEntries(body.games.map((g: { slug: string }) => [g.slug, g]));
    expect(bySlug["word-guess"]).toMatchObject({ played: 1, won: 1, winRate: 100 });
    expect(bySlug["word-guess"].bestScore).toBeGreaterThan(0);
    expect(bySlug["number-puzzle"]).toMatchObject({ played: 1, won: 0, winRate: 0, averageScore: 0 });
    expect(body.wordGuessDistribution).toEqual([0, 1, 0, 0, 0, 0]);
  });
});
