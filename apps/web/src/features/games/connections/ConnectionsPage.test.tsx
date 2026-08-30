import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { ConnectionsPage } from "./ConnectionsPage";

const WORDS = [
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT",
  "NINE", "TEN", "ELEVEN", "TWELVE", "RED", "BLUE", "GREEN", "PINK",
];

function seedInProgressEntry() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["games", "connections", "today"], {
    slug: "connections",
    name: "Connections",
    description: "Group 16 words into four hidden categories.",
    icon: "🟩",
    difficulty: "medium",
    available: true,
    puzzleNumber: 1,
    status: "in_progress",
    score: null,
    mistakeCount: 0,
    content: { words: WORDS, solved: [], mistakesRemaining: 4, complete: false },
  });
  return queryClient;
}

describe("ConnectionsPage tile selection", () => {
  it("only allows up to 4 tiles selected at once, and toggling a selected tile deselects it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionsPage />, seedInProgressEntry());

    const submitButton = await screen.findByRole("button", { name: "Submit" });
    expect(submitButton).toBeDisabled();

    for (const word of ["ONE", "TWO", "THREE", "FOUR"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    expect(submitButton).toBeEnabled();
    for (const word of ["ONE", "TWO", "THREE", "FOUR"]) {
      expect(screen.getByRole("button", { name: word })).toHaveAttribute("aria-pressed", "true");
    }

    // A 5th tile shouldn't be accepted — still exactly 4 selected, submit stays enabled.
    await user.click(screen.getByRole("button", { name: "FIVE" }));
    expect(screen.getByRole("button", { name: "FIVE" })).toHaveAttribute("aria-pressed", "false");
    expect(submitButton).toBeEnabled();

    // Deselecting one of the four drops the count below 4 and disables submit again.
    await user.click(screen.getByRole("button", { name: "ONE" }));
    expect(screen.getByRole("button", { name: "ONE" })).toHaveAttribute("aria-pressed", "false");
    expect(submitButton).toBeDisabled();
  });

  it("clears the whole selection when Deselect all is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionsPage />, seedInProgressEntry());

    await user.click(await screen.findByRole("button", { name: "ONE" }));
    await user.click(screen.getByRole("button", { name: "TWO" }));
    expect(screen.getByRole("button", { name: "ONE" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(screen.getByRole("button", { name: "ONE" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "TWO" })).toHaveAttribute("aria-pressed", "false");
  });
});
