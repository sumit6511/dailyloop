import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { LogicPuzzlePage } from "./LogicPuzzlePage";

afterEach(() => vi.restoreAllMocks());

const GRID = [
  [1, 2, 3, 4, 5, 6],
  [4, 5, 6, 1, 2, 3],
  [2, 3, 1, 5, 6, 4],
  [5, 6, 4, 2, 3, 1],
  [3, 1, 2, 6, 4, 5],
  [6, 4, 5, 3, 1, 2],
];

describe("LogicPuzzlePage hints", () => {
  it("shows the hint's cost, and offers to clear a wrong cell when the hint says so", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const data = url.endsWith("/attempts/hint")
        ? { hint: { row: 0, col: 1, value: 0, kind: "fix" }, hintsUsed: 1 }
        : url.endsWith("/today")
          ? queryClient.getQueryData(["games", "logic-puzzle", "today"]) // the page refetches itself
          : { activeMs: 0, complete: false };
      return new Response(JSON.stringify({ data }), {
        headers: { "content-type": "application/json" },
      });
    });
    const puzzle = GRID.map((row, r) => row.map((v, c) => (r === 0 && c === 1 ? 0 : v)));
    const grid = puzzle.map((row, r) => row.map((v, c) => (r === 0 && c === 1 ? 3 : v))); // a wrong 3
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["games", "logic-puzzle", "today"], {
      slug: "logic-puzzle",
      name: "Logic Puzzle",
      description: "",
      icon: "",
      difficulty: "hard",
      available: true,
      puzzleNumber: 1,
      status: "in_progress",
      score: null,
      mistakeCount: 0,
      hintsUsed: 0,
      activeMs: 0,
      content: { puzzle, grid, complete: false },
    });
    const user = userEvent.setup();
    renderWithProviders(<LogicPuzzlePage />, queryClient);

    const hintButton = await screen.findByRole("button", { name: "Hint (costs 10 points)" });
    expect(hintButton).toHaveTextContent("−10");
    await user.click(hintButton);
    expect(await screen.findByText(/Row 1, column 2 isn.t right/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear it" })).toBeInTheDocument();
  });
});
