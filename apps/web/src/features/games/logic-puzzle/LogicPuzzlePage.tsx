import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove, useCheckProgress } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Spinner } from "../../../components/Spinner";
import { GameTile } from "../../../components/GameTile";
import { Button } from "../../../components/Button";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";
import { useToast } from "../../../lib/toast-context";

interface LogicPuzzleView {
  puzzle: number[][];
  grid: number[][];
  complete: boolean;
  won?: boolean;
}

interface CheckResult {
  cells: { row: number; col: number; correct: boolean }[];
}

const BOX_ROWS = 2;
const BOX_COLS = 3;
const GRID_SIZE = 6;
const CELEBRATE_MS = 900;

function boxOf(row: number, col: number): number {
  return Math.floor(row / BOX_ROWS) * (GRID_SIZE / BOX_COLS) + Math.floor(col / BOX_COLS);
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function LogicPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("logic-puzzle");
  const submitMove = useSubmitMove("logic-puzzle");
  const checkProgress = useCheckProgress<CheckResult>("logic-puzzle");
  const { showToast } = useToast();
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justFilled, setJustFilled] = useState<{ row: number; col: number } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [wrongCells, setWrongCells] = useState<{ row: number; col: number }[]>([]);
  const [notesMode, setNotesMode] = useState(false);
  // Pencil marks are purely a local scratchpad — never sent to the server, never scored.
  const [notes, setNotes] = useState<Record<string, Set<number>>>({});

  useAutoStartAttempt("logic-puzzle", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
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

  const view = entry.content as LogicPuzzleView | null;
  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  const isGiven = (row: number, col: number) => view.puzzle[row]![col] !== 0;

  const clearNotes = (row: number, col: number) => {
    setNotes((prev) => {
      const key = cellKey(row, col);
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleNote = (n: number) => {
    if (!selected || isGiven(selected.row, selected.col)) return;
    const key = cellKey(selected.row, selected.col);
    setNotes((prev) => {
      const current = new Set(prev[key]);
      if (current.has(n)) current.delete(n);
      else current.add(n);
      return { ...prev, [key]: current };
    });
  };

  const fillCell = async (value: number) => {
    if (!selected || view.complete || isGiven(selected.row, selected.col)) return;
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
      if ((response.content as LogicPuzzleView).won) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

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

  const showResult = view.complete && !celebrating;

  if (showResult) {
    return (
      <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle">
        <ResultScreen
          gameName="Logic Puzzle"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[]}
          newAchievementKeys={newAchievements}
        />
      </GameShell>
    );
  }

  return (
    <GameShell icon={<GameIcon slug="logic-puzzle" size="lg" />} title="Logic Puzzle" subtitle="Fill every row, column, and box with 1–6.">
      <div className="mx-auto grid w-fit grid-cols-6 gap-0.5 rounded-xl border-2 border-white/[0.16] bg-white/[0.16] p-0.5">
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
            const cellNotes = value === 0 ? notes[cellKey(r, c)] : undefined;
            const rightBorder = c === 2 ? "border-r-2 border-r-white/[0.16]" : "";
            const bottomBorder = r === 1 || r === 3 ? "border-b-2 border-b-white/[0.16]" : "";
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={given}
                onClick={() => setSelected({ row: r, col: c })}
                style={celebrating ? { animationDelay: `${(r + c) * 40}ms` } : undefined}
                className={`relative flex h-11 w-11 items-center justify-center text-lg font-bold transition-colors sm:h-12 sm:w-12 ${rightBorder} ${bottomBorder} ${
                  isJustFilled ? "animate-pop-in" : ""
                } ${celebrating ? "animate-tile-bounce" : ""} ${
                  given
                    ? "bg-white/[0.03] text-white/50"
                    : isWrong
                      ? "bg-rose-500/20 text-rose-300 ring-2 ring-inset ring-rose-500/60"
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

      <div className="mt-3 flex justify-center gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <GameTile
            key={n}
            size="sm"
            onClick={() => (notesMode ? toggleNote(n) : void fillCell(n))}
            disabled={!selected}
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
          disabled={!selected}
          aria-label="Erase cell"
        >
          <Icon name="backspace" className="text-base" />
        </GameTile>
      </div>

      <div className="mt-4 flex justify-center">
        <Button variant="secondary" size="sm" isLoading={checkProgress.isPending} onClick={() => void checkAnswers()}>
          Check my answers
        </Button>
      </div>
    </GameShell>
  );
}
