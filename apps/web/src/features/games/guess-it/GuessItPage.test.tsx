import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { GuessItPage } from "./GuessItPage";

afterEach(() => vi.restoreAllMocks());

describe("GuessItPage", () => {
  it("catches a repeated guess (ignoring case, accents and a leading 'the') without sending it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["games", "guess-it", "today"], {
      slug: "guess-it",
      name: "Guess It",
      description: "",
      icon: "",
      difficulty: "easy",
      available: true,
      puzzleNumber: 1,
      status: "in_progress",
      score: null,
      mistakeCount: 1,
      hintsUsed: 0,
      activeMs: 0,
      content: {
        category: "Places",
        clues: ["one", "two"],
        cluesRevealed: 2,
        guesses: [{ guess: "Eiffel Tower", correct: false }],
        complete: false,
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<GuessItPage />, queryClient);

    await user.type(await screen.findByLabelText("Your guess"), "  the EIFFEL tówer{Enter}");
    expect(await screen.findByText(/already tried that/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
