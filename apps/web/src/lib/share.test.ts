import { describe, it, expect } from "vitest";
import { formatShareText, type ShareData } from "./share";

describe("formatShareText", () => {
  it("formats a plain game line with no pattern", () => {
    const data: ShareData = {
      date: "2026-08-31",
      games: [{ slug: "connections", icon: "🟩", name: "Connections", score: 92 }],
      totalScore: 92,
      currentStreak: 3,
    };
    const text = formatShareText(data);
    expect(text).toContain("🟩 Connections  92");
    expect(text).toContain("⭐ Total: 92");
    expect(text).toContain("🔥 3 Day Streak");
  });

  it("appends the Word Guess emoji pattern on its own line, below the score line", () => {
    const data: ShareData = {
      date: "2026-08-31",
      games: [
        { slug: "word-guess", icon: "🟨", name: "Word Guess", score: 100, pattern: "⬜🟨⬜⬜🟩\n🟩🟩🟩🟩🟩" },
      ],
      totalScore: 100,
      currentStreak: 1,
    };
    const text = formatShareText(data);
    const lines = text.split("\n");
    const scoreLineIndex = lines.findIndex((l) => l.includes("Word Guess"));
    expect(lines[scoreLineIndex + 1]).toBe("⬜🟨⬜⬜🟩");
    expect(lines[scoreLineIndex + 2]).toBe("🟩🟩🟩🟩🟩");
  });

  it("never includes anything beyond icon/name/score/pattern (no letters or answers)", () => {
    const data: ShareData = {
      date: "2026-08-31",
      games: [{ slug: "word-guess", icon: "🟨", name: "Word Guess", score: 80, pattern: "🟩🟩🟩🟩🟩" }],
      totalScore: 80,
      currentStreak: 0,
    };
    const text = formatShareText(data);
    expect(text).not.toMatch(/[A-Z]{4,}/); // no all-caps run that would look like a revealed word
  });
});
