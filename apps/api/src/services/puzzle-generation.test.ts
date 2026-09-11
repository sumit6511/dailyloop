import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { getTodayKey, dateKeyToJSDate, addDaysToKey } from "@dailyloop/shared";
import { registerAllGames } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";
import { generatePuzzleForGame, nextPuzzleNumber } from "./puzzle-generation.js";

describe("generatePuzzleForGame", () => {
  beforeAll(() => {
    registerAllGames();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
  });

  const todayKey = getTodayKey("Asia/Kathmandu");

  it("creates a puzzle on the first call using the game's real generator", async () => {
    await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });

    const result = await generatePuzzleForGame("word-guess", todayKey, { status: "PUBLISHED" });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.puzzle.status).toBe("PUBLISHED");
    expect((result.puzzle.content as { answer: string }).answer).toMatch(/^[A-Z]{5}$/);
  });

  it("returns already_exists rather than throwing on a duplicate (gameId, date)", async () => {
    const game = await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(todayKey),
        puzzleNumber: 1,
        status: "PUBLISHED",
        content: { answer: "CRANE" },
      },
    });

    const result = await generatePuzzleForGame("word-guess", todayKey, { status: "PUBLISHED" });
    expect(result.kind).toBe("already_exists");
  });

  it("returns already_exists when an ARCHIVED row already occupies that date (doesn't resurrect it)", async () => {
    const game = await prisma.game.create({
      data: { slug: "word-guess", name: "Word Guess", description: "d", icon: "🟨", sortOrder: 0 },
    });
    await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date: dateKeyToJSDate(todayKey),
        puzzleNumber: 1,
        status: "ARCHIVED",
        content: { answer: "CRANE" },
      },
    });

    const result = await generatePuzzleForGame("word-guess", todayKey, { status: "PUBLISHED" });
    expect(result.kind).toBe("already_exists");
  });

  it("returns no_module for a game with no registered generator", async () => {
    await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });

    const result = await generatePuzzleForGame("mock-game", todayKey, { status: "PUBLISHED" });
    expect(result.kind).toBe("no_module");
  });

  it("returns game_not_found for an unknown slug", async () => {
    const result = await generatePuzzleForGame("does-not-exist", todayKey, { status: "PUBLISHED" });
    expect(result.kind).toBe("game_not_found");
  });

  it("threads contentIdentity from prior rows into recentlyUsed, avoiding repeats across the whole 30-entry bank", async () => {
    await prisma.game.create({
      data: { slug: "guess-it", name: "Guess It", description: "d", icon: "🎯", sortOrder: 0 },
    });

    // Generate 30 consecutive days — Guess It's bank has exactly 30 entries, so LRU selection
    // should place every one of them exactly once with zero repeats across the whole run.
    const seenAnswers = new Set<string>();
    let dateKey = "2026-01-01";
    for (let i = 0; i < 30; i++) {
      const result = await generatePuzzleForGame("guess-it", dateKey, { status: "PUBLISHED" });
      expect(result.kind).toBe("created");
      if (result.kind !== "created") return;
      const answer = (result.puzzle.content as { answer: string }).answer;
      expect(seenAnswers.has(answer)).toBe(false);
      seenAnswers.add(answer);
      dateKey = addDaysToKey(dateKey, 1);
    }
    expect(seenAnswers.size).toBe(30);
  });
});

describe("nextPuzzleNumber", () => {
  afterEach(async () => {
    await prisma.dailyPuzzle.deleteMany();
    await prisma.game.deleteMany();
  });

  it("starts at 1 for a game with no puzzles yet, and increments after one exists", async () => {
    const game = await prisma.game.create({
      data: { slug: "mock-game", name: "Mock Game", description: "d", icon: "🧪", sortOrder: 0 },
    });
    expect(await nextPuzzleNumber(game.id)).toBe(1);

    await prisma.dailyPuzzle.create({
      data: { gameId: game.id, date: new Date(), puzzleNumber: 1, status: "PUBLISHED", content: {} },
    });
    expect(await nextPuzzleNumber(game.id)).toBe(2);
  });
});
