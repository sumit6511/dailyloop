import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SCORE } from "@dailyloop/shared";
import { useGameToday, useAutoStartAttempt, useSubmitMove, useHint } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { GameTile } from "../../../components/GameTile";
import { HudChip } from "../Hud";
import { Button } from "../../../components/Button";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";
import { useToast } from "../../../lib/toast-context";
import { useActiveTimer } from "../../../lib/use-active-timer";
import { getSettings, setSettings, type LogicPuzzleSettings } from "./settings";

interface LogicPuzzleView {
  puzzle: number[][];
  grid: number[][];
  complete: boolean;
  won?: boolean;
  mistakes?: number;
}

interface HintSuggestion {
  row: number;
  col: number;
  /** 0 when `kind` is "fix" — clearing the cell is the suggestion. */
  value: number;
  /** "fix" = a filled cell that's wrong. Absent from older API responses, which mean "place". */
  kind?: "place" | "fix";
}

type HistoryEntry =
  | { type: "notes"; priorNotes: Record<string, Set<number>> }
  | { type: "grid"; row: number; col: number; priorValue: number };

const BOX_ROWS = 2;
const BOX_COLS = 3;
const GRID_SIZE = 6;
const CELEBRATE_MS = 900;
const GROUP_CELEBRATE_MS = 650;
const SHAKE_MS = 450;
const POP_MS = 300;

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

function peerCells(row: number, col: number): [number, number][] {
  const seen = new Set<string>([cellKey(row, col)]);
  const result: [number, number][] = [];
  for (const [r, c] of [...rowCells(row), ...colCells(col), ...boxCells(row, col)]) {
    const key = cellKey(r, c);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([r, c]);
  }
  return result;
}

// Every committed cell is guaranteed legal against its row/column/box the moment it's placed
// (illegal placements are rejected outright — see `replay()` in the game engine), so a fully
// filled group of 6 distinct cells from the 1-6 domain is necessarily a complete, correct
// permutation. No solution lookup needed to know a filled group is a *correct* group.
function groupIsFilled(grid: number[][], cells: [number, number][]): boolean {
  return cells.every(([r, c]) => grid[r]![c] !== 0);
}

// Figures out *why* a placement was rejected, purely from the grid as it stood right before
// submitting — cheap and solution-free, just for a friendlier inline message.
function conflictReason(
  grid: number[][],
  row: number,
  col: number,
  value: number,
): "row" | "column" | "box" {
  const conflicts = (cells: [number, number][]) =>
    cells.some(([r, c]) => !(r === row && c === col) && grid[r]![c] === value);
  if (conflicts(rowCells(row))) return "row";
  if (conflicts(colCells(col))) return "column";
  return "box";
}

function countOf(grid: number[][], value: number): number {
  return grid.reduce((sum, row) => sum + row.filter((v) => v === value).length, 0);
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SettingRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-white/[0.14] transition-colors checked:bg-brand-600 before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-on-accent before:transition-transform checked:before:translate-x-4"
      />
    </label>
  );
}

function SettingsPopover({
  settings,
  onChange,
}: {
  settings: LogicPuzzleSettings;
  onChange: (next: LogicPuzzleSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function updateRect() {
      const el = buttonRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      setRect({ top: box.bottom + 6, right: window.innerWidth - box.right });
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Logic Puzzle settings"
        onClick={() => setOpen((o) => !o)}
        className="surface-inset flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
      >
        <Icon name="settings" className="text-xl" />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Logic Puzzle settings"
              style={{ top: rect.top, right: rect.right }}
              className="animate-menu-in glass-strong fixed z-50 w-64 p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-white">Settings</h3>
              <div className="flex flex-col gap-3">
                <SettingRow
                  label="Highlight row, column & box"
                  checked={settings.highlightSections}
                  onChange={(v) => onChange({ ...settings, highlightSections: v })}
                />
                <SettingRow
                  label="Show remaining counts"
                  checked={settings.countRemaining}
                  onChange={(v) => onChange({ ...settings, countRemaining: v })}
                />
                <SettingRow
                  label="Start in Notes mode"
                  checked={settings.notesModeDefault}
                  onChange={(v) => onChange({ ...settings, notesModeDefault: v })}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function LogicPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("logic-puzzle");
  const submitMove = useSubmitMove("logic-puzzle");
  const hint = useHint<HintSuggestion | null>("logic-puzzle");
  const { showToast } = useToast();
  const [settings, setSettingsState] = useState<LogicPuzzleSettings>(() => getSettings());
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [justFilled, setJustFilled] = useState<{ row: number; col: number } | null>(null);
  const [rejectedCell, setRejectedCell] = useState<{ row: number; col: number } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [celebratingCells, setCelebratingCells] = useState<Set<string>>(new Set());
  const [notesMode, setNotesMode] = useState(() => settings.notesModeDefault);
  // Pencil marks are purely a local scratchpad — never sent to the server, never scored.
  const [notes, setNotes] = useState<Record<string, Set<number>>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hintSuggestion, setHintSuggestion] = useState<HintSuggestion | null>(null);
  // Hints are charged server-side; this just mirrors the latest count from a hint response until
  // the refetched entry catches up.
  const [latestHintsUsed, setLatestHintsUsed] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useAutoStartAttempt("logic-puzzle", entry?.status);
  const hintsUsed = latestHintsUsed ?? entry?.hintsUsed ?? 0;

  const view = (entry?.content ?? null) as LogicPuzzleView | null;

  // Active play time, kept in step with the server — the timer pauses while the player is away,
  // and the server scores exactly the time shown (logic-puzzle uses `timing: "active"`).
  const elapsedSeconds = useActiveTimer("logic-puzzle", {
    initialActiveMs: entry?.activeMs,
    running: entry?.status === "in_progress" && !view?.complete,
  });

  const isGiven = useCallback(
    (row: number, col: number) => (view ? view.puzzle[row]![col] !== 0 : false),
    [view],
  );

  const clearNotes = useCallback(
    (row: number, col: number) => {
      const key = cellKey(row, col);
      if (!notes[key]) return;
      setHistory((h) => [...h, { type: "notes", priorNotes: notes }]);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [notes],
  );

  const toggleNote = useCallback(
    (n: number) => {
      if (!selected || isGiven(selected.row, selected.col)) return;
      setHistory((h) => [...h, { type: "notes", priorNotes: notes }]);
      const key = cellKey(selected.row, selected.col);
      setNotes((prev) => {
        const current = new Set(prev[key]);
        if (current.has(n)) current.delete(n);
        else current.add(n);
        return { ...prev, [key]: current };
      });
    },
    [selected, isGiven, notes],
  );

  const fillCell = useCallback(
    async (cell: { row: number; col: number }, value: number) => {
      if (!view || view.complete || isGiven(cell.row, cell.col)) return;
      const priorValue = view.grid[cell.row]![cell.col]!;
      if (priorValue === value) return;
      setError(null);
      setRejectMessage(null);
      try {
        const response = await submitMove.mutateAsync({ row: cell.row, col: cell.col, value });
        const newView = response.content as LogicPuzzleView;
        const landedValue = newView.grid[cell.row]![cell.col]!;

        if (landedValue !== value) {
          // Rejected — the placement duplicated a value already in this row/column/box, so
          // nothing was committed and the grid is exactly as it was before this attempt.
          setRejectedCell(cell);
          setRejectMessage(
            `That number's already in this ${conflictReason(view.grid, cell.row, cell.col, value)}.`,
          );
          setTimeout(() => setRejectedCell((prev) => (prev === cell ? null : prev)), SHAKE_MS);
          return;
        }

        if (response.newlyUnlockedAchievements?.length) {
          setNewAchievements(response.newlyUnlockedAchievements);
        }
        setHistory((h) => [...h, { type: "grid", row: cell.row, col: cell.col, priorValue }]);
        clearNotes(cell.row, cell.col);

        if (value !== 0) {
          setJustFilled(cell);
          setTimeout(() => setJustFilled((prev) => (prev === cell ? null : prev)), POP_MS);
          // A newly placed value can no longer be a candidate in any peer cell's pencil marks.
          setNotes((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const [r, c] of peerCells(cell.row, cell.col)) {
              const key = cellKey(r, c);
              if (next[key]?.has(value)) {
                const updated = new Set(next[key]);
                updated.delete(value);
                next[key] = updated;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }

        if (newView.won) {
          setCelebrating(true);
          setTimeout(() => setCelebrating(false), CELEBRATE_MS);
        } else if (value !== 0) {
          const groups = [rowCells(cell.row), colCells(cell.col), boxCells(cell.row, cell.col)];
          const filledGroups = groups.filter((g) => groupIsFilled(newView.grid, g));
          if (filledGroups.length > 0) {
            setCelebratingCells(new Set(filledGroups.flat().map(([r, c]) => cellKey(r, c))));
            setTimeout(() => setCelebratingCells(new Set()), GROUP_CELEBRATE_MS);
          }
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
      }
    },
    [view, isGiven, clearNotes, submitMove],
  );

  const undo = useCallback(async () => {
    if (!view || view.complete || history.length === 0) return;
    const last = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    if (last.type === "notes") {
      setNotes(last.priorNotes);
      return;
    }
    setError(null);
    try {
      const response = await submitMove.mutateAsync({
        row: last.row,
        col: last.col,
        value: last.priorValue,
      });
      const newView = response.content as LogicPuzzleView;
      if (newView.grid[last.row]![last.col] !== last.priorValue) {
        showToast("Couldn't undo — that number's no longer valid there", "error");
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't undo", "error");
    }
  }, [view, history, submitMove, showToast]);

  const requestHint = useCallback(async () => {
    if (!view || view.complete || hint.isPending) return;
    try {
      const { hint: suggestion, hintsUsed: charged } = await hint.mutateAsync();
      setLatestHintsUsed(charged);
      if (suggestion) {
        setHintSuggestion(suggestion);
        setSelected({ row: suggestion.row, col: suggestion.col });
      } else {
        showToast("No hint available right now.", "info");
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't get a hint", "error");
    }
  }, [view, hint, showToast]);

  const acceptHint = useCallback(() => {
    if (!hintSuggestion) return;
    const { row, col, value } = hintSuggestion;
    setHintSuggestion(null);
    setSelected({ row, col });
    void fillCell({ row, col }, value);
  }, [hintSuggestion, fillCell]);

  const updateSettings = useCallback((next: LogicPuzzleSettings) => {
    setSettingsState(next);
    setSettings(next);
  }, []);

  // Keyboard input mirrors the on-screen controls: digits 1-6 fill the selected cell (or toggle
  // a pencil mark in Notes mode), Backspace/Delete/0 erase it, arrow keys move the selection,
  // N toggles Notes mode, H asks for a hint, U undoes the last move. Placed before the early
  // returns below (Rules of Hooks) — the `!view` guard means it's a no-op until the puzzle loads.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!view || view.complete || resetting) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        setSelected((prev) => {
          const base = prev ?? { row: 0, col: 0 };
          let { row, col } = base;
          if (e.key === "ArrowUp") row = Math.max(0, row - 1);
          else if (e.key === "ArrowDown") row = Math.min(GRID_SIZE - 1, row + 1);
          else if (e.key === "ArrowLeft") col = Math.max(0, col - 1);
          else if (e.key === "ArrowRight") col = Math.min(GRID_SIZE - 1, col + 1);
          return { row, col };
        });
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "n") {
        setNotesMode((m) => !m);
        return;
      }
      if (key === "h") {
        void requestHint();
        return;
      }
      if (key === "u") {
        void undo();
        return;
      }
      if (!selected || isGiven(selected.row, selected.col)) return;
      if (e.key >= "1" && e.key <= "6") {
        const n = Number(e.key);
        if (notesMode) toggleNote(n);
        else void fillCell(selected, n);
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        if (notesMode) clearNotes(selected.row, selected.col);
        else void fillCell(selected, 0);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    view,
    selected,
    notesMode,
    resetting,
    fillCell,
    toggleNote,
    clearNotes,
    isGiven,
    requestHint,
    undo,
  ]);

  if (isLoading || !entry) {
    return (
      <GameShell
        slug="logic-puzzle"
        icon={<GameIcon slug="logic-puzzle" size="lg" />}
        title="Logic Puzzle"
      >
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell
        slug="logic-puzzle"
        icon={<GameIcon slug="logic-puzzle" size="lg" />}
        title="Logic Puzzle"
      >
        <p className="text-center text-fg-subtle">
          No Logic Puzzle is available today. Check back soon!
        </p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell
        slug="logic-puzzle"
        icon={<GameIcon slug="logic-puzzle" size="lg" />}
        title="Logic Puzzle"
      >
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

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
    setRejectMessage(null);
    setSelected(null);
    setNotes({});
    setHistory([]);
    setHintSuggestion(null);
    try {
      // Erasing (value 0) never counts toward the mistake tally in replay() — same guarantee
      // the single-cell Erase button already relies on — so resetting the whole board this way
      // can't be used to wipe out a real scored mistake.
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
      <GameShell
        slug="logic-puzzle"
        icon={<GameIcon slug="logic-puzzle" size="lg" />}
        title="Logic Puzzle"
      >
        <ResultScreen
          gameName="Logic Puzzle"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[
            { label: "Mistakes", value: String(view.mistakes ?? 0) },
            { label: "Hints used", value: String(hintsUsed) },
          ]}
          newAchievementKeys={newAchievements}
        />
      </GameShell>
    );
  }

  const selectedValue = selected ? view.grid[selected.row]![selected.col]! : 0;

  return (
    <GameShell
      slug="logic-puzzle"
      showRulesOnFirstVisit
      icon={<GameIcon slug="logic-puzzle" size="lg" />}
      title="Logic Puzzle"
      subtitle="Fill every row, column, and box with 1–6."
      headerRight={
        <div className="flex items-center gap-3">
          <HudChip>
            <Icon name="timer" className="text-base text-accent-300" />
            <span className="tabular font-mono text-sm text-white/85">
              {formatElapsed(elapsedSeconds)}
            </span>
          </HudChip>
          <SettingsPopover settings={settings} onChange={updateSettings} />
        </div>
      }
    >
      <div className="relative mx-auto w-fit">
        {celebrating ? (
          <div
            className="animate-glow-pulse absolute inset-0 -z-10 rounded-xl bg-emerald-500/40 blur-xl"
            aria-hidden="true"
          />
        ) : null}
        <div className="grid grid-cols-6 gap-px overflow-hidden rounded-2xl border border-white/[0.16] bg-white/[0.1] shadow-[0_24px_48px_-24px_var(--shadow-deep)]">
          {view.grid.map((row, r) =>
            row.map((value, c) => {
              const given = isGiven(r, c);
              const isSelected = selected?.row === r && selected?.col === c;
              const isSectionPeer =
                settings.highlightSections &&
                !isSelected &&
                !!selected &&
                (r === selected.row ||
                  c === selected.col ||
                  boxOf(r, c) === boxOf(selected.row, selected.col));
              const isMatchingValue = !isSelected && !!selectedValue && value === selectedValue;
              const isJustFilled = justFilled?.row === r && justFilled?.col === c;
              const isRejecting = rejectedCell?.row === r && rejectedCell?.col === c;
              const isCelebratingCell = celebratingCells.has(cellKey(r, c));
              const isHintTarget = hintSuggestion?.row === r && hintSuggestion?.col === c;
              const cellNotes = value === 0 ? notes[cellKey(r, c)] : undefined;
              // Thicker rules between the 2×3 boxes.
              const rightBorder = c === 2 ? "border-r-2 border-r-white/30" : "";
              const bottomBorder = r === 1 || r === 3 ? "border-b-2 border-b-white/30" : "";

              // Solid fills (the 1px gaps between cells are the grid lines): printed digits are
              // bright white on a raised cell, the player's own entries are cyan.
              let bgClass: string;
              if (given) bgClass = "bg-ink-700 text-white";
              else if (isCelebratingCell) bgClass = "bg-[var(--cell-win)] text-emerald-100";
              else if (isSelected) bgClass = "bg-brand-600 text-on-accent";
              else if (isSectionPeer) bgClass = "bg-[var(--cell-peer)] text-accent-200";
              else bgClass = "bg-ink-900 text-accent-200 hover:bg-ink-850";

              let ringClass = "";
              if (isRejecting) ringClass = "ring-2 ring-inset ring-rose-500/70";
              else if (isCelebratingCell) ringClass = "ring-2 ring-inset ring-emerald-400/70";
              else if (isHintTarget) ringClass = "ring-2 ring-inset ring-amber-400/70";
              else if (isMatchingValue) ringClass = "ring-2 ring-inset ring-accent-400/50";

              const cellLabel = `Row ${r + 1}, column ${c + 1}, ${
                given
                  ? `given ${value}`
                  : value !== 0
                    ? `filled with ${value}`
                    : cellNotes?.size
                      ? `empty, notes ${[...cellNotes].sort((a, b) => a - b).join(", ")}`
                      : "empty"
              }${isSelected ? ", selected" : ""}`;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={given || resetting}
                  aria-label={cellLabel}
                  onClick={() => setSelected({ row: r, col: c })}
                  style={celebrating ? { animationDelay: `${(r + c) * 40}ms` } : undefined}
                  className={`relative flex h-12 w-12 items-center justify-center font-display text-xl font-bold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-400 sm:h-14 sm:w-14 sm:text-2xl ${rightBorder} ${bottomBorder} ${
                    isJustFilled ? "animate-pop-in" : ""
                  } ${isRejecting ? "animate-shake" : ""} ${
                    celebrating || isCelebratingCell ? "animate-tile-bounce" : ""
                  } ${bgClass} ${ringClass}`}
                >
                  {value !== 0 ? (
                    value
                  ) : isHintTarget ? (
                    <span className="text-amber-300/70">{hintSuggestion?.value}</span>
                  ) : cellNotes?.size ? (
                    <span className="grid h-full w-full grid-cols-3 grid-rows-2 place-items-center gap-0 p-1 font-mono text-[9px] font-medium leading-none text-fg-subtle sm:text-[10px]">
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

      {rejectMessage || error ? (
        <p role="alert" className="text-center text-sm font-medium text-rose-300">
          {rejectMessage ?? error}
        </p>
      ) : null}

      {hintSuggestion ? (
        <div className="animate-pop-in mx-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
          <Icon name="lightbulb" className="text-lg" filled />
          {hintSuggestion.kind === "fix" ? (
            <>
              Row {hintSuggestion.row + 1}, column {hintSuggestion.col + 1} isn&apos;t right.
              <Button size="sm" variant="secondary" onClick={acceptHint}>
                Clear it
              </Button>
            </>
          ) : (
            <>
              Row {hintSuggestion.row + 1}, column {hintSuggestion.col + 1} can be{" "}
              {hintSuggestion.value}.
              <Button size="sm" variant="secondary" onClick={acceptHint}>
                Place {hintSuggestion.value}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label="Dismiss hint"
            onClick={() => setHintSuggestion(null)}
          >
            <Icon name="close" className="text-base" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center">
          <Button
            variant={notesMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setNotesMode((m) => !m)}
          >
            <Icon name="edit_note" className="text-lg" /> Notes {notesMode ? "On" : "Off"}
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const remaining = 6 - countOf(view.grid, n);
            return (
              <div key={n} className="relative">
                <GameTile
                  size="md"
                  onClick={() => {
                    if (!selected) return;
                    if (notesMode) toggleNote(n);
                    else void fillCell(selected, n);
                  }}
                  disabled={!selected || resetting}
                  className={settings.countRemaining && remaining <= 0 ? "opacity-40" : ""}
                >
                  {n}
                </GameTile>
                {settings.countRemaining ? (
                  <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white/[0.1] bg-ink-800 px-1 font-mono text-[10px] font-semibold text-fg-muted">
                    {remaining}
                  </span>
                ) : null}
              </div>
            );
          })}
          <GameTile
            size="md"
            onClick={() => {
              if (!selected) return;
              if (notesMode) clearNotes(selected.row, selected.col);
              else void fillCell(selected, 0);
            }}
            disabled={!selected || resetting}
            aria-label="Erase cell"
          >
            <Icon name="backspace" className="text-xl" />
          </GameTile>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          isLoading={hint.isPending}
          disabled={resetting || !!hintSuggestion}
          onClick={() => void requestHint()}
          title={`Each new hint costs ${SCORE.HINT_PENALTY} points`}
        >
          <Icon name="lightbulb" className="text-lg" /> Hint{" "}
          <span className="font-mono text-[11px] font-medium text-amber-300">
            −{SCORE.HINT_PENALTY}
          </span>
          <span className="sr-only"> (costs {SCORE.HINT_PENALTY} points)</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isLoading={submitMove.isPending && history.at(-1)?.type === "grid"}
          disabled={history.length === 0 || resetting}
          onClick={() => void undo()}
        >
          <Icon name="undo" className="text-lg" /> Undo
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
