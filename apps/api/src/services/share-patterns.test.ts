import { describe, it, expect } from "vitest";
import { sharePattern } from "./share-patterns.js";

describe("sharePattern", () => {
  it("draws a Word Guess grid from letter feedback", () => {
    const content = {
      guesses: [
        {
          word: "STORM",
          feedback: ["absent", "present", "absent", "absent", "correct"].map((status) => ({
            letter: "X",
            status,
          })),
        },
      ],
    };
    expect(sharePattern("word-guess", content)).toBe("⬜🟨⬜⬜🟩");
  });

  it("colours each Connections guess by its words' real categories", () => {
    const content = {
      categories: [
        { difficulty: 1, words: ["A1", "A2", "A3", "A4"] },
        { difficulty: 2, words: ["B1", "B2", "B3", "B4"] },
        { difficulty: 3, words: ["C1", "C2", "C3", "C4"] },
        { difficulty: 4, words: ["D1", "D2", "D3", "D4"] },
      ],
      guesses: [
        { words: ["A1", "A2", "A3", "B1"] },
        { words: ["a1", "A2", "A3", "A4"] },
        { words: ["D1", "D2", "D3", "D4"] },
      ],
    };
    expect(sharePattern("connections", content)).toBe("🟨🟨🟨🟩\n🟨🟨🟨🟨\n🟪🟪🟪🟪");
  });

  it("shows Guess It clues used, padding unused ones", () => {
    expect(sharePattern("guess-it", { guesses: [{ correct: false }, { correct: true }] })).toBe(
      "🟥🟩⬜⬜",
    );
  });

  it("never leaks words, letters or answers", () => {
    const pattern = sharePattern("connections", {
      categories: [{ difficulty: 1, words: ["SECRET", "WORDS", "HERE", "NOW"] }],
      guesses: [{ words: ["SECRET", "WORDS", "HERE", "NOW"] }],
    })!;
    expect(pattern).not.toMatch(/[A-Za-z0-9]/);
  });

  it("returns nothing for games without a pattern or content without guesses", () => {
    expect(sharePattern("logic-puzzle", { grid: [] })).toBeUndefined();
    expect(sharePattern("connections", null)).toBeUndefined();
  });
});
