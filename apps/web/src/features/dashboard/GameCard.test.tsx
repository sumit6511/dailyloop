import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import type { TodayGameEntryDTO } from "@dailyloop/shared";
import { renderWithProviders } from "../../test/render";
import { GameCard } from "./GameCard";

const entry = (overrides: Partial<TodayGameEntryDTO>): TodayGameEntryDTO => ({
  slug: "word-guess",
  name: "Word Guess",
  description: "Guess the daily word in six tries.",
  icon: "🟨",
  difficulty: "medium",
  available: true,
  puzzleNumber: 12,
  status: "completed",
  won: true,
  score: 87,
  mistakeCount: 0,
  hintsUsed: 0,
  activeMs: 0,
  content: null,
  startedAt: "2026-11-25T08:00:00.000Z",
  ...overrides,
});

describe("GameCard", () => {
  it("marks a won game as solved, with its score", () => {
    renderWithProviders(<GameCard game={entry({})} />);
    expect(screen.getByText("Solved")).toBeInTheDocument();
    expect(screen.getByText("87 pts")).toBeInTheDocument();
  });

  it("marks a lost game as missed, not solved", () => {
    renderWithProviders(<GameCard game={entry({ won: false, score: 0 })} />);
    expect(screen.getByText("Missed")).toBeInTheDocument();
    expect(screen.queryByText("Solved")).not.toBeInTheDocument();
  });
});
