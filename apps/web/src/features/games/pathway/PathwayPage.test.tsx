import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../../test/render";
import { PathwayPage } from "./PathwayPage";

type Cell = { row: number; col: number };
const VIEW = {
  size: 3,
  checkpoints: [
    { row: 0, col: 0 },
    { row: 2, col: 2 },
  ],
  walls: [],
  complete: false,
};

// A stand-in API that applies moves the way the server does: extend, or step back onto the
// second-to-last cell. Enough to exercise the page's input handling end to end.
let serverPath: Cell[] = [];
const submitted: Cell[] = [];
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const entry = () => ({
  slug: "pathway",
  name: "Pathway",
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
  content: { ...VIEW, path: serverPath },
});

beforeEach(() => {
  serverPath = [];
  submitted.length = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/attempts/submit")) {
      const move = JSON.parse(String(init?.body)).move as Cell;
      submitted.push(move);
      serverPath =
        serverPath.length >= 2 && same(move, serverPath[serverPath.length - 2]!)
          ? serverPath.slice(0, -1)
          : [...serverPath, move];
      const data = {
        complete: false,
        content: { ...VIEW, path: serverPath },
        newlyUnlockedAchievements: [],
      };
      return new Response(JSON.stringify({ data }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: entry() }), {
      headers: { "content-type": "application/json" },
    });
  });
});

afterEach(() => vi.restoreAllMocks());

function renderPage() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["games", "pathway", "today"], entry());
  return renderWithProviders(<PathwayPage />, queryClient);
}

const progress = () => document.getElementById("pathway-progress")!.textContent;

describe("PathwayPage keyboard controls", () => {
  it("starts on 1 with the first arrow press, draws with arrows, and steps back with Backspace", async () => {
    const user = userEvent.setup();
    renderPage();
    const board = await screen.findByRole("application");
    board.focus();

    await user.keyboard("{ArrowRight}"); // empty board: starts on checkpoint 1
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
    await waitFor(() => expect(progress()).toContain("4 of 9 cells filled"));
    expect(submitted).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ]);

    await user.keyboard("{Backspace}");
    await waitFor(() => expect(progress()).toContain("3 of 9 cells filled"));
    expect(submitted.at(-1)).toEqual({ row: 0, col: 2 }); // a retreat is a move onto the previous cell
  });

  it("ignores an arrow that would leave the board", async () => {
    const user = userEvent.setup();
    renderPage();
    (await screen.findByRole("application")).focus();
    await user.keyboard("{ArrowUp}{ArrowUp}"); // start on (0,0), then up is off the board
    await waitFor(() => expect(progress()).toContain("1 of 9 cells filled"));
    expect(submitted).toHaveLength(1);
  });
});

describe("PathwayPage tap to backtrack", () => {
  it("cuts the path back to a tapped trail cell", async () => {
    const user = userEvent.setup();
    renderPage();
    const board = await screen.findByRole("application");
    board.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}");
    await waitFor(() => expect(progress()).toContain("4 of 9 cells filled"));

    // jsdom has no layout, so point "hit testing" at the tapped cell directly.
    const target = board.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(board, { clientX: 1, clientY: 1, pointerId: 1 });

    await waitFor(() => expect(progress()).toContain("2 of 9 cells filled"));
    expect(serverPath).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });
});
