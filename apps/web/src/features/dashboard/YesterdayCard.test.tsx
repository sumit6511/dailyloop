import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { YesterdayAnswersDTO } from "@dailyloop/shared";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { YesterdayCard } from "./YesterdayCard";

afterEach(() => vi.restoreAllMocks());

function serve(data: YesterdayAnswersDTO) {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } }),
  );
}

const cell = (row: number, col: number) => ({ row, col });

describe("YesterdayCard", () => {
  it("lists each game with the player's result, keeping answers folded away until opened", async () => {
    serve({
      date: "2026-11-23",
      games: [
        {
          slug: "word-guess",
          name: "Word Guess",
          icon: "🟨",
          puzzleNumber: 41,
          answer: { kind: "word", answer: "CRANE" },
          result: { completed: true, won: true, score: 812 },
        },
        {
          slug: "number-puzzle",
          name: "Number Puzzle",
          icon: "🔢",
          puzzleNumber: 40,
          answer: {
            kind: "equation",
            numbers: [2, 3, 4],
            target: 14,
            expression: "(2 + 3) × 4 − 6",
          },
          result: { completed: true, won: false, score: 120 },
        },
        {
          slug: "logic-puzzle",
          name: "Logic Puzzle",
          icon: "🧠",
          puzzleNumber: 39,
          answer: {
            kind: "grid",
            rows: [
              [1, 2],
              [2, 1],
            ],
            givens: [
              [true, false],
              [false, true],
            ],
          },
          result: { completed: false, won: false, score: null },
        },
        {
          slug: "pathway",
          name: "Pathway",
          icon: "🧵",
          puzzleNumber: 38,
          answer: {
            kind: "path",
            size: 2,
            path: [cell(0, 0), cell(0, 1), cell(1, 1), cell(1, 0)],
            checkpoints: [cell(0, 0), cell(1, 0)],
            walls: [{ a: cell(0, 0), b: cell(1, 0) }],
          },
          result: null,
        },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<YesterdayCard />, createTestQueryClient());

    expect(await screen.findByText("Yesterday’s answers")).toBeInTheDocument();
    expect(screen.getByText(/Solved · 812 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Missed · 120 pts/)).toBeInTheDocument();
    expect(screen.getByText("Unfinished")).toBeInTheDocument();
    expect(screen.getByText("Not played")).toBeInTheDocument();

    const word = screen.getByLabelText("CRANE");
    expect(word).not.toBeVisible();
    await user.click(screen.getByText("Word Guess"));
    expect(word).toBeVisible();

    expect(screen.getByText("(2 + 3) × 4 − 6 = 14")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Solved grid: 1 2, 2 1/, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /2×2 path through 2 checkpoints/, hidden: true }),
    ).toBeInTheDocument();
  });

  it("renders nothing when there were no puzzles yesterday", async () => {
    serve({ date: "2026-11-23", games: [] });
    const queryClient = createTestQueryClient();
    renderWithProviders(<YesterdayCard />, queryClient);
    await waitFor(() => expect(queryClient.getQueryData(["games", "yesterday"])).toBeDefined());
    expect(screen.queryByText("Yesterday’s answers")).not.toBeInTheDocument();
  });
});
