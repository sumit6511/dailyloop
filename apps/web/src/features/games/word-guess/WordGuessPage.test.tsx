import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { WordGuessPage } from "./WordGuessPage";

function seedInProgressEntry() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["games", "word-guess", "today"], {
    slug: "word-guess",
    name: "Word Guess",
    description: "Guess the daily word in six tries.",
    icon: "🟨",
    difficulty: "medium",
    available: true,
    puzzleNumber: 1,
    status: "in_progress",
    score: null,
    mistakeCount: 0,
    content: { guesses: [], guessesRemaining: 6, complete: false },
  });
  return queryClient;
}

describe("WordGuessPage on-screen keyboard", () => {
  it("builds up the current guess as on-screen letters are clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WordGuessPage />, seedInProgressEntry());

    for (const letter of ["C", "R", "A", "N", "E"]) {
      await user.click(await screen.findByRole("button", { name: letter }));
    }

    expect(screen.getByRole("group", { name: "Current guess: CRANE" })).toBeInTheDocument();
  });

  it("removes the last letter on backspace, and stops accepting letters at 5", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WordGuessPage />, seedInProgressEntry());

    for (const letter of ["C", "R", "A", "N", "E"]) {
      await user.click(await screen.findByRole("button", { name: letter }));
    }
    // A 6th letter shouldn't be appended once the row is full.
    await user.click(screen.getByRole("button", { name: "S" }));
    expect(screen.getByRole("group", { name: "Current guess: CRANE" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByRole("group", { name: "Current guess: CRAN" })).toBeInTheDocument();
  });

  it("disables Enter until 5 letters have been entered", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WordGuessPage />, seedInProgressEntry());

    const enterButton = await screen.findByRole("button", { name: "Enter" });
    expect(enterButton).toBeDisabled();

    for (const letter of ["C", "R", "A", "N"]) {
      await user.click(screen.getByRole("button", { name: letter }));
    }
    expect(enterButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "E" }));
    expect(enterButton).toBeEnabled();
  });
});
