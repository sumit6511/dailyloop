import { describe, it, expect } from "vitest";
import { guessItGame, type GuessItContent, type GuessItMove } from "./index.js";
import { GUESS_IT_ENTRIES } from "./entries.js";

const DATE = "2026-08-29";

describe("guess-it: generatePuzzle", () => {
  it("is deterministic for the same date and recentlyUsed", () => {
    const a = guessItGame.generatePuzzle("s", DATE);
    const b = guessItGame.generatePuzzle("s", DATE);
    expect(a).toEqual(b);
  });

  it("prefers an entry that hasn't been used recently", () => {
    const answers = GUESS_IT_ENTRIES.map((e) => e.answer);
    const recentlyUsed = answers.slice(1); // every entry except the first marked as recently used
    const content = guessItGame.generatePuzzle("s", DATE, recentlyUsed);
    expect(content.answer).toBe(answers[0]);
  });
});

describe("guess-it: contentIdentity", () => {
  it("returns the answer", () => {
    expect(guessItGame.contentIdentity!({ category: "c", answer: "Facebook", aliases: [], clues: ["1", "2", "3", "4"] })).toEqual([
      "Facebook",
    ]);
  });
});

describe("guess-it: validateAttempt", () => {
  const content: GuessItContent = {
    category: "Technology",
    answer: "Facebook",
    aliases: ["Meta"],
    clues: ["clue1", "clue2", "clue3", "clue4"],
  };

  it("wins immediately on a correct first guess, case- and punctuation-insensitive", () => {
    const result = guessItGame.validateAttempt(content, [{ guess: "face-book!" }]);
    expect(result.won).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.result.cluesRevealed).toBe(1);
  });

  it("accepts a known alias as correct", () => {
    const result = guessItGame.validateAttempt(content, [{ guess: "meta" }]);
    expect(result.won).toBe(true);
  });

  it("reveals one more clue per wrong guess, up to all 4", () => {
    const moves: GuessItMove[] = [{ guess: "wrong1" }, { guess: "wrong2" }];
    const result = guessItGame.validateAttempt(content, moves);
    expect(result.result.cluesRevealed).toBe(3);
    expect(result.complete).toBe(false);
  });

  it("ends as a loss after 4 wrong guesses without ever revealing the answer", () => {
    const moves: GuessItMove[] = [{ guess: "a" }, { guess: "b" }, { guess: "c" }, { guess: "d" }];
    const result = guessItGame.validateAttempt(content, moves);
    expect(result.complete).toBe(true);
    expect(result.won).toBe(false);
    expect(result.result.gaveUp).toBe(true);
  });
});

describe("guess-it: calculateScore", () => {
  const content: GuessItContent = {
    category: "Technology",
    answer: "Facebook",
    aliases: [],
    clues: ["clue1", "clue2", "clue3", "clue4"],
  };

  it("scores guessing right on clue 1 higher than guessing right on clue 3", () => {
    const first = guessItGame.validateAttempt(content, [{ guess: "Facebook" }]);
    const third = guessItGame.validateAttempt(content, [{ guess: "a" }, { guess: "b" }, { guess: "Facebook" }]);
    const firstScore = guessItGame.calculateScore(content, first.result, { durationMs: 5_000 });
    const thirdScore = guessItGame.calculateScore(content, third.result, { durationMs: 5_000 });
    expect(thirdScore.total).toBeLessThan(firstScore.total);
  });

  it("scores a loss at 0", () => {
    const lost = guessItGame.validateAttempt(content, [{ guess: "a" }, { guess: "b" }, { guess: "c" }, { guess: "d" }]);
    const score = guessItGame.calculateScore(content, lost.result, { durationMs: 5_000 });
    expect(score.total).toBe(0);
  });
});

describe("guess-it: sanitizeForClient", () => {
  const content: GuessItContent = {
    category: "Technology",
    answer: "Facebook",
    aliases: [],
    clues: ["clue1", "clue2", "clue3", "clue4"],
  };

  it("shows only one clue and no answer before the player has started", () => {
    const view = guessItGame.sanitizeForClient(content, null) as { clues: string[]; answer?: string };
    expect(view.clues).toEqual(["clue1"]);
    expect(view.answer).toBeUndefined();
  });

  it("never reveals the answer while still in progress", () => {
    const view = guessItGame.sanitizeForClient(content, { status: "IN_PROGRESS", moves: [{ guess: "wrong" }] }) as {
      clues: string[];
      answer?: string;
    };
    expect(view.clues).toEqual(["clue1", "clue2"]);
    expect(view.answer).toBeUndefined();
  });

  it("reveals the answer once completed", () => {
    const view = guessItGame.sanitizeForClient(content, {
      status: "COMPLETED",
      moves: [{ guess: "Facebook" }],
    }) as { answer?: string };
    expect(view.answer).toBe("Facebook");
  });
});
