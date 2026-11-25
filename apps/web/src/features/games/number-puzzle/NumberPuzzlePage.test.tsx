import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { NumberPuzzlePage } from "./NumberPuzzlePage";

let pool: number[];
const moves: unknown[] = [];
const view = () => ({ numbers: [2, 3, 4, 5], target: 20, pool, steps: [], complete: false });
const entry = () => ({
  slug: "number-puzzle",
  name: "Number Puzzle",
  description: "",
  icon: "",
  difficulty: "medium",
  available: true,
  puzzleNumber: 1,
  status: "in_progress",
  score: null,
  mistakeCount: 0,
  hintsUsed: 0,
  activeMs: 0,
  content: view(),
});
const json = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });

beforeEach(() => {
  pool = [2, 3, 4, 5];
  moves.length = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (!String(input).endsWith("/attempts/submit")) return json(entry());
    const move = JSON.parse(String(init?.body)).move as { type: string; a?: number; b?: number };
    moves.push(move);
    if (move.type === "combine")
      pool = [...pool.filter((n) => n !== move.a && n !== move.b), move.a! * move.b!];
    return json({
      complete: move.type === "submit",
      content: view(),
      newlyUnlockedAchievements: [],
    });
  });
});
afterEach(() => vi.restoreAllMocks());

function renderPage() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["games", "number-puzzle", "today"], entry());
  return renderWithProviders(<NumberPuzzlePage />, queryClient);
}

describe("NumberPuzzlePage", () => {
  it("combines two picked numbers with the picked operator", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "multiply" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await waitFor(() => expect(moves).toEqual([{ type: "combine", a: 4, b: 5, op: "*" }]));
  });

  it("asks before submitting short of the target, so a stray tap can't forfeit the day", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Submit answer/ }));
    expect(screen.getByText("You haven't made 20 yet")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "You haven't made 20 yet" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(moves).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Submit answer/ }));
    await user.click(screen.getByRole("button", { name: "Give up" }));
    await waitFor(() => expect(moves).toEqual([{ type: "submit" }]));
  });

  it("submits straight away once the target is on the board", async () => {
    pool = [2, 3, 20];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Submit answer/ }));
    expect(screen.queryByRole("dialog", { name: /haven't made/ })).not.toBeInTheDocument();
    await waitFor(() => expect(moves).toEqual([{ type: "submit" }]));
  });
});
