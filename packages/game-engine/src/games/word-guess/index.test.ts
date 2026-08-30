import { describe, it, expect } from "vitest";
import { wordGuessGame, type WordGuessContent, type WordGuessMove } from "./index.js";

const DATE = "2026-08-29";

describe("word-guess: generatePuzzle", () => {
  it("is deterministic for the same date and produces a 5-letter uppercase answer", () => {
    const a = wordGuessGame.generatePuzzle("unused-seed", DATE);
    const b = wordGuessGame.generatePuzzle("unused-seed", DATE);
    expect(a).toEqual(b);
    expect(a.answer).toMatch(/^[A-Z]{5}$/);
  });

  it("differs across dates", () => {
    const day1 = wordGuessGame.generatePuzzle("s", "2026-08-29").answer;
    const day2 = wordGuessGame.generatePuzzle("s", "2026-08-30").answer;
    expect(day1).not.toBe(day2);
  });
});

describe("word-guess: validateAttempt feedback (duplicate letters)", () => {
  const content: WordGuessContent = { answer: "ABBEY" };

  it("only credits as many duplicate letters as actually remain, prioritizing earlier positions", () => {
    // answer ABBEY, guess BOBBY: position 2 and 4 are exact matches (B, Y). Of the 3 B's the
    // guess spits out, only one A/B/E-leftover B exists in the answer once exact matches are
    // set aside — the earliest non-matching B claims it, the later one gets nothing.
    const result = wordGuessGame.validateAttempt(content, [{ guess: "BOBBY" }]);
    const feedback = result.result.guesses[0]!.feedback.map((f) => f.status);
    expect(feedback).toEqual(["present", "absent", "correct", "absent", "correct"]);
  });

  it("marks a fully correct guess as won and complete immediately, even on guess 1", () => {
    const result = wordGuessGame.validateAttempt(content, [{ guess: "ABBEY" }]);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.mistakes).toBe(0);
  });
});

describe("word-guess: game-over conditions", () => {
  const content: WordGuessContent = { answer: "CRANE" };

  it("is not complete before 6 guesses if the answer hasn't been found", () => {
    const moves: WordGuessMove[] = Array.from({ length: 5 }, () => ({ guess: "STAMP" }));
    const result = wordGuessGame.validateAttempt(content, moves);
    expect(result.complete).toBe(false);
    expect(result.won).toBe(false);
  });

  it("ends the game as a loss after 6 wrong guesses", () => {
    const moves: WordGuessMove[] = Array.from({ length: 6 }, () => ({ guess: "STAMP" }));
    const result = wordGuessGame.validateAttempt(content, moves);
    expect(result.complete).toBe(true);
    expect(result.won).toBe(false);
    expect(result.result.gaveUp).toBe(true);
    expect(result.mistakes).toBe(6);
  });
});

describe("word-guess: calculateScore", () => {
  const content: WordGuessContent = { answer: "CRANE" };

  it("scores a first-guess win at the maximum", () => {
    const result = wordGuessGame.validateAttempt(content, [{ guess: "CRANE" }]);
    const score = wordGuessGame.calculateScore(content, result.result, { durationMs: 5_000 });
    expect(score.total).toBe(100);
  });

  it("scores fewer remaining guesses lower than more efficient wins", () => {
    const fast = wordGuessGame.validateAttempt(content, [{ guess: "CRANE" }]);
    const slow = wordGuessGame.validateAttempt(content, [
      { guess: "STAMP" },
      { guess: "STAMP" },
      { guess: "STAMP" },
      { guess: "STAMP" },
      { guess: "CRANE" },
    ]);
    const fastScore = wordGuessGame.calculateScore(content, fast.result, { durationMs: 30_000 });
    const slowScore = wordGuessGame.calculateScore(content, slow.result, { durationMs: 30_000 });
    expect(slowScore.total).toBeLessThan(fastScore.total);
  });

  it("scores a loss at 0", () => {
    const moves: WordGuessMove[] = Array.from({ length: 6 }, () => ({ guess: "STAMP" }));
    const lost = wordGuessGame.validateAttempt(content, moves);
    const score = wordGuessGame.calculateScore(content, lost.result, { durationMs: 60_000 });
    expect(score.total).toBe(0);
  });
});

describe("word-guess: sanitizeForClient", () => {
  const content: WordGuessContent = { answer: "CRANE" };

  it("never reveals the answer before the attempt is complete", () => {
    const inProgress = wordGuessGame.sanitizeForClient(content, {
      status: "IN_PROGRESS",
      moves: [{ guess: "STAMP" }],
    }) as { answer?: string };
    expect(inProgress.answer).toBeUndefined();
  });

  it("reveals the answer once the attempt is completed", () => {
    const done = wordGuessGame.sanitizeForClient(content, {
      status: "COMPLETED",
      moves: [{ guess: "CRANE" }],
    }) as { answer?: string };
    expect(done.answer).toBe("CRANE");
  });
});
