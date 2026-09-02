import { useCallback, useEffect, useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove, useCheckProgress } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { GameTile } from "../../../components/GameTile";
import { Button } from "../../../components/Button";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";
import { useToast } from "../../../lib/toast-context";

interface LogicPuzzleView {
  puzzle: number[][];
  grid: number[][];
  complete: boolean;
  won?: boolean;
  mistakes?: number;
}

interface CheckResult {
  cells: { row: number; col: number; correct: boolean }[];
}

const BOX_ROWS = 2;
const BOX_COLS = 3;
const GRID_SIZE = 6;
const CELEBRATE_MS = 900;
const GROUP_CELEBRATE_MS = 650;

function BoardSkeleton() {
  return (
    <div className="mx-auto grid w-fit grid-cols-6 gap-0.5 rounded-xl border-2 border-white/[0.16] bg-white/[0.16] p-0.5">
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
        <Skeleton key={i} shape="block" className="h-10 w-10 !rounded-none sm:h-12 sm:w-12" />
      ))}
    </div>
  );
}

function boxOf(row: number, col: number): number {
  return Math.floor(row / BOX_ROWS) * (GRID_SIZE / BOX_COLS) + Math.floor(col / BOX_COLS);
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function rowCells(row: number): [number, number][] {
  return Array.from({ length: GRID_SIZE }, (_, c) => [row, c]);
}

function colCells(col: number): [number, number][] {
  return Array.from({ length: GRID_SIZE }, (_, r) => [r, col]);
}

function boxCells(row: number, col: number): [number, number][] {
  const box = boxOf(row, col);
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (boxOf(r, c) === box) cells.push([r, c]);
    }
  }
  return cells;
}

// Cheap client-side pre-filter: is every cell in this group filled at all? This alone doesn't
// mean the group is *correct* — the client never has the solution mid-game, so actual
// correctness is verified separately via checkProgress before celebrating.
function groupIsFilled(grid: number[][], cells: [number, number][]): boolean {
  return cells.every(([r, c]) => grid[r]![c] !== 0);
}

export function LogicPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("logic-puzzle");
  const submitMove = useSubmitMove("logic-puzzle");
  const checkProgress = useCheckProgress<CheckResult>("logic-puzzle");
  // Separate mutation instance from `checkProgress` above — this one runs silently in the
  // background after a move to gate the group-completion celebration, so its pending state
  // never flashes the loading spinner on the visible "Check my answers" button.
  const silentCheck = useCheckProgress<CheckResult>("logic-puzzle");
  const { showToast } = useToast();
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justFilled, setJustFilled] = useState<{ row: number; col: number } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [celebratingCells, setCelebratingCells] = useState<Set<string>>(new Set());
  const [wrongCells, setWrongCells] = useState<{ row: number; col: number }[]>([]);
  const [notesMode, setNotesMode] = useState(false);
  // Pencil marks are purely a local scratchpad — never sent to the server, never scored.
  const [notes, setNotes] = useState<Record<string, Set<number>>>({});
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useAutoStartAttempt("logic-puzzle", entry?.status);

  const view = (entry?.content ?? null) as LogicPuzzleView | null;

  const isGiven = useCallback((row: number, col: number) => (view ? view.puzzle[row]![col] !== 0 : false), [view]);

  const clearNotes = useCallback((row: number, col: number) => {
    setNotes((prev) => {
      const key = cellKey(row, col);
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const toggleNote = useCallback(
    (n: number) => {
      if (!selected || isGiven(selected.row, selected.col)) return;
      const key = cellKey(selected.row, selected.col);
      setNotes((prev) => {
        const current = new Set(prev[key]);
        if (current.has(n)) current.delete(n);
        else current.add(n);
        return { ...prev, [key]: current };
      });
    },
    [selected, isGiven],
  );

  const fillCell = useCallback(async (value: number) => {
    if (!view || !selected || view.complete || isGiven(selected.row, selected.col)) return;
    setError(null);
    setWrongCells([]); // the grid is about to change — any earlier check result is now stale
    const cell = selected;
    clearNotes(cell.row, cell.col); // the cell is about to hold a real value (or be erased)
    if (value !== 0) {
      setJustFilled(cell);
      setTimeout(() => setJustFilled((prev) => (prev === cell ? null : prev)), 300);
    }
    try {
      const response = await submitMove.mutateAsync({ row: cell.row, col: cell.col, value });
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
      const newView = response.content as LogicPuzzleView;
      if (newView.won) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      } else if (value !== 0) {
        const groups = [rowCells(cell.row), colCells(cell.col), boxCells(cell.row, cell.col)];
        const filledGroups = groups.filter((g) => groupIsFilled(newView.grid, g));
        if (filledGroups.length > 0) {
          try {
            const check = await silentCheck.mutateAsync();
            const wrongSet = new Set(check.cells.filter((c) => !c.correct).map((c) => cellKey(c.row, c.col)));
            const correctGroups = filledGroups.filter((g) => g.every(([r, c]) => !wrongSet.has(cellKey(r, c))));
            if (correctGroups.length > 0) {
              setCelebratingCells(new Set(correctGroups.flat().map(([r, c]) => cellKey(r, c))));
              setTimeout(() => setCelebratingCells(new Set()), GROUP_CELEBRATE_MS);
            }
          } catch {
            // Cosmetic-only feature — if the correctness check fails, just skip the celebration
            // silently rather than surfacing an error for something the player didn't ask for.
          }
        }
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  }, [view, selected, isGiven, clearNotes, submitMove, silentCheck]);

  // Keyboard input mirrors the on-screen number pad exactly: digits 1-6 fill the selected cell
  // (or toggle a pencil mark in Notes mode), Backspace/Delete/0 erase it. Placed before the
  // early returns below (Rules of Hooks) — the `!view`/`!selected` guard means it's a no-op
  // whenever the puzzle isn't actually loaded yet.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!view || !selected || view.complete || resetting) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isGiven(selected.row, selected.col)) return;
      if (e.key >= "1" && e.key <= "6") {
        const n = Number(e.key);
        if (notesMode) toggleNote(n);
        else void fillCell(n);
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        if (notesMode) clearNotes(selected.row, selected.col);
        else void fillCell(0);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, selected, notesMode, resetting, fillCell, toggleNote, clearNotes, isGiven]);

  if (isLoading || !entry) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <p className="text-center text-white/50">No Logic Puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  const checkAnswers = async () => {
    setError(null);
    try {
      const result = await checkProgress.mutateAsync();
      const wrong = result.cells.filter((c) => !c.correct);
      setWrongCells(wrong);
      if (wrong.length === 0) {
        showToast("Everything filled in so far looks right!", "success");
      } else {
        showToast(`${wrong.length} cell${wrong.length === 1 ? "" : "s"} need${wrong.length === 1 ? "s" : ""} a second look`, "error");
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't check your progress", "error");
    }
  };

  const resetGrid = async () => {
    setConfirmingReset(false);
    const filledCells: { row: number; col: number }[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!isGiven(r, c) && view.grid[r]![c] !== 0) filledCells.push({ row: r, col: c });
      }
    }
    if (filledCells.length === 0) return;
    setResetting(true);
    setError(null);
    setSelected(null);
    setWrongCells([]);
    setNotes({});
    try {
      // Erasing (value 0) never counts toward the mistake tally in replay() — same guarantee
      // the single-cell Erase button already relies on — so resetting the whole board this way
      // can't be used to wipe out a real scored mistake, unlike undoing moves would.
      for (const cell of filledCells) {
        await submitMove.mutateAsync({ row: cell.row, col: cell.col, value: 0 });
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't reset the puzzle", "error");
    } finally {
      setResetting(false);
    }
  };

  const showResult = view.complete && !celebrating;

  if (showResult) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <ResultScreen
          gameName="Logic Puzzle"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Mistakes", value: String(view.mistakes ?? 0) }]}
          newAchievementKeys={newAchievements}
        />
      </GameShell>
    );
  }

  return (
    <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle" subtitle="Fill every row, column, and box with 1–6.">
      <div className="relative mx-auto w-fit">
        {celebrating ? (
          <div className="animate-glow-pulse absolute inset-0 -z-10 rounded-xl bg-emerald-500/40 blur-xl" aria-hidden="true" />
        ) : null}
        <div className="grid grid-cols-6 gap-0.5 rounded-xl border-2 border-white/[0.16] bg-white/[0.16] p-0.5">
          {view.grid.map((row, r) =>
          row.map((value, c) => {
            const given = isGiven(r, c);
            const isSelected = selected?.row === r && selected?.col === c;
            const isPeer =
              !isSelected &&
              !!selected &&
              (r === selected.row || c === selected.col || boxOf(r, c) === boxOf(selected.row, selected.col));
            const isJustFilled = justFilled?.row === r && justFilled?.col === c;
            const isWrong = wrongCells.some((w) => w.row === r && w.col === c);
            const isCelebratingCell = celebratingCells.has(cellKey(r, c));
            const cellNotes = value === 0 ? notes[cellKey(r, c)] : undefined;
            const rightBorder = c === 2 ? "border-r-2 border-r-white/[0.16]" : "";
            const bottomBorder = r === 1 || r === 3 ? "border-b-2 border-b-white/[0.16]" : "";
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={given || resetting}
                onClick={() => setSelected({ row: r, col: c })}
                style={celebrating ? { animationDelay: `${(r + c) * 40}ms` } : undefined}
                className={`relative flex h-10 w-10 items-center justify-center text-lg font-bold transition-colors sm:h-12 sm:w-12 ${rightBorder} ${bottomBorder} ${
                  isJustFilled ? "animate-pop-in" : ""
                } ${celebrating || isCelebratingCell ? "animate-tile-bounce" : ""} ${
                  isCelebratingCell ? "ring-2 ring-inset ring-emerald-400/70" : ""
                } ${
                  given
                    ? "bg-white/[0.03] text-white/50"
                    : isWrong
                      ? "bg-rose-500/20 text-rose-300 ring-2 ring-inset ring-rose-500/60"
                      : isCelebratingCell
                        ? "bg-emerald-500/25 text-emerald-100"
                        : isSelected
                          ? "bg-brand-600 text-white"
                          : isPeer
                            ? "bg-brand-500/[0.12] text-white"
                            : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
                }`}
              >
                {value !== 0 ? (
                  value
                ) : cellNotes?.size ? (
                  <span className="grid grid-cols-3 grid-rows-2 place-items-center gap-0 p-0.5 text-[8px] font-semibold leading-none text-white/45 sm:text-[9px]">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <span key={n}>{cellNotes.has(n) ? n : ""}</span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          }),
        )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-center text-sm font-medium text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button variant={notesMode ? "primary" : "secondary"} size="sm" onClick={() => setNotesMode((m) => !m)}>
          <Icon name="edit_note" className="text-lg" /> Notes {notesMode ? "On" : "Off"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <GameTile
            key={n}
            size="sm"
            onClick={() => (notesMode ? toggleNote(n) : void fillCell(n))}
            disabled={!selected || resetting}
          >
            {n}
          </GameTile>
        ))}
        <GameTile
          size="sm"
          onClick={() => {
            if (notesMode) {
              if (selected) clearNotes(selected.row, selected.col);
            } else {
              void fillCell(0);
            }
          }}
          disabled={!selected || resetting}
          aria-label="Erase cell"
        >
          <Icon name="backspace" className="text-base" />
        </GameTile>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          isLoading={checkProgress.isPending}
          disabled={resetting}
          onClick={() => void checkAnswers()}
        >
          <Icon name="fact_check" className="text-lg" /> Check my answers
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isLoading={resetting}
          disabled={!view.grid.some((row, r) => row.some((v, c) => v !== 0 && !isGiven(r, c)))}
          onClick={() => setConfirmingReset(true)}
        >
          <Icon name="restart_alt" className="text-lg" /> Reset
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title="Reset the grid?"
        body="This clears every cell you've filled in so far, keeping the given clues. This can't be undone."
        confirmLabel="Reset"
        danger
        onConfirm={() => void resetGrid()}
        onCancel={() => setConfirmingReset(false)}
      />
    </GameShell>
  );
}
