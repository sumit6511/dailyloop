import { useEffect, useRef, useState } from "react";
import { SCORE } from "@dailyloop/shared";
import { useGameToday, useAutoStartAttempt, useSubmitMove, useHint } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { HudChip } from "../Hud";
import { GameIcon } from "../../../components/GameIcon";
import { Button } from "../../../components/Button";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";
import { useToast } from "../../../lib/toast-context";

interface Cell {
  row: number;
  col: number;
}

interface Wall {
  a: Cell;
  b: Cell;
}

interface PathwayView {
  size: number;
  checkpoints: Cell[];
  walls: Wall[];
  path: Cell[];
  complete: boolean;
  won?: boolean;
  mistakes?: number;
}

/** "extend": the next cell to draw into. "retreat": the path can't be finished from here — back
 * up to this cell (the last one from which it still can). */
interface PathwayHint {
  kind: "extend" | "retreat";
  cell: Cell;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function cellIndex(cells: Cell[], target: Cell): number {
  return cells.findIndex((c) => sameCell(c, target));
}

function hasWall(walls: Wall[], a: Cell, b: Cell): boolean {
  return walls.some(
    (w) => (sameCell(w.a, a) && sameCell(w.b, b)) || (sameCell(w.a, b) && sameCell(w.b, a)),
  );
}

function highestCheckpointInPath(path: Cell[], checkpoints: Cell[]): number {
  let max = 0;
  for (const cell of path) {
    const idx = cellIndex(checkpoints, cell);
    if (idx >= 0 && idx + 1 > max) max = idx + 1;
  }
  return max;
}

/**
 * Mirrors the server's replay() predicate closely enough to give instant local feedback while a
 * drag is in flight — it is NOT the source of truth (the server's response after each submitted
 * move always wins), just a same-turn prediction so the drawn line doesn't lag behind the
 * pointer. Deliberately not imported from @dailyloop/game-engine: apps/web has no dependency on
 * that package, game logic is server-only by design.
 */
function applyLocalStep(view: PathwayView, path: Cell[], move: Cell): Cell[] | null {
  if (move.row < 0 || move.row >= view.size || move.col < 0 || move.col >= view.size) return null;

  if (path.length === 0) {
    return cellIndex(view.checkpoints, move) === 0 ? [move] : null;
  }

  const head = path[path.length - 1]!;
  if (sameCell(move, head)) return null;

  if (path.length >= 2 && sameCell(move, path[path.length - 2]!)) {
    return path.slice(0, -1);
  }
  if (path.length > 1 && sameCell(move, path[0]!)) {
    return [path[0]!];
  }

  const isAdjacent = Math.abs(move.row - head.row) + Math.abs(move.col - head.col) === 1;
  if (!isAdjacent) return null;
  if (hasWall(view.walls, head, move)) return null;
  if (path.some((c) => sameCell(c, move))) return null;

  const checkpointIdx = cellIndex(view.checkpoints, move);
  if (checkpointIdx >= 0) {
    const checkpointNumber = checkpointIdx + 1;
    if (checkpointNumber !== highestCheckpointInPath(path, view.checkpoints) + 1) return null;
    if (checkpointNumber === view.checkpoints.length && path.length + 1 !== view.size * view.size)
      return null;
  }

  return [...path, move];
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function BoardSkeleton() {
  return (
    <div className="mx-auto aspect-square w-full max-w-sm">
      <Skeleton shape="block" className="h-full w-full" />
    </div>
  );
}

export function PathwayPage() {
  const { data: entry, isLoading } = useGameToday("pathway");
  const submitMove = useSubmitMove("pathway");
  const hint = useHint<PathwayHint>("pathway");
  const { showToast } = useToast();
  const [hintSuggestion, setHintSuggestion] = useState<PathwayHint | null>(null);
  const [latestHintsUsed, setLatestHintsUsed] = useState<number | null>(null);
  const [localPath, setLocalPath] = useState<Cell[]>([]);
  const [dragging, setDragging] = useState(false);
  const [blockedCell, setBlockedCell] = useState<Cell | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastHitRef = useRef<Cell | null>(null);
  const queueRef = useRef<Cell[]>([]);
  const processingRef = useRef(false);

  useAutoStartAttempt("pathway", entry?.status);
  const hintsUsed = latestHintsUsed ?? entry?.hintsUsed ?? 0;

  const view = (entry?.content ?? null) as PathwayView | null;

  useEffect(() => {
    if (view && !dragging) setLocalPath(view.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.path, dragging]);

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const move = queueRef.current.shift()!;
      try {
        const response = await submitMove.mutateAsync(move);
        const newView = response.content as PathwayView;
        setLocalPath(newView.path);
        if (response.newlyUnlockedAchievements?.length) {
          setNewAchievements(response.newlyUnlockedAchievements);
        }
      } catch {
        // A dropped move just means the next queued one likely gets rejected too (adjacency to
        // a stale head) — harmless, the server's state remains authoritative either way.
      }
    }
    processingRef.current = false;
  };

  const handleAt = (row: number, col: number) => {
    if (!view || view.complete) return;
    const move = { row, col };
    if (lastHitRef.current && sameCell(lastHitRef.current, move)) return;
    lastHitRef.current = move;

    const predicted = applyLocalStep(view, localPath, move);
    if (predicted) setHintSuggestion(null); // the board changed, so the hint may no longer apply
    if (!predicted) {
      if (localPath.length > 0) {
        setBlockedCell(move);
        setTimeout(() => setBlockedCell((prev) => (prev === move ? null : prev)), 250);
      }
      return;
    }
    setLocalPath(predicted);
    queueRef.current.push(move);
    void processQueue();
  };

  const requestHint = async () => {
    if (!view || view.complete || hint.isPending) return;
    try {
      const { hint: suggestion, hintsUsed: charged } = await hint.mutateAsync();
      setLatestHintsUsed(charged);
      if (suggestion) setHintSuggestion(suggestion);
      else showToast("No hint available right now.", "info");
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't get a hint", "error");
    }
  };

  /** Cut the path back to `cell` (an earlier cell on it). The server only knows single-step
   * retreats (moving onto the second-to-last cell), so this queues one per removed cell. */
  const backtrackTo = (cell: Cell) => {
    const target = cellIndex(localPath, cell);
    if (target < 0 || target === localPath.length - 1) return;
    for (let i = localPath.length - 2; i >= target; i--) queueRef.current.push(localPath[i]!);
    setLocalPath(localPath.slice(0, target + 1));
    setHintSuggestion(null);
    void processQueue();
  };

  const acceptHint = () => {
    if (!view || !hintSuggestion) return;
    const { kind, cell } = hintSuggestion;
    setHintSuggestion(null);
    if (kind === "retreat") {
      backtrackTo(cell);
      return;
    }
    const predicted = applyLocalStep(view, localPath, cell);
    if (!predicted) return;
    setLocalPath(predicted);
    queueRef.current.push(cell);
    void processQueue();
  };

  /** One step from the keyboard: arrows move the head (the first press starts on 1), Backspace
   * steps back. Same moves a drag sends, so the server can't tell the difference. */
  const onBoardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!view || view.complete) return;
    const delta = ARROW_DELTAS[event.key];
    const head = localPath[localPath.length - 1];
    let target: Cell | undefined;
    if (delta) {
      target = head ? { row: head.row + delta[0], col: head.col + delta[1] } : view.checkpoints[0];
    } else if (event.key === "Backspace" || event.key === "Delete") {
      target = localPath.length >= 2 ? localPath[localPath.length - 2] : undefined;
    } else {
      return;
    }
    event.preventDefault();
    if (!target) return;
    lastHitRef.current = null;
    handleAt(target.row, target.col);
  };

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-row]");
    if (!el) return null;
    return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!view || view.complete) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    const head = localPath[localPath.length - 1];
    // Tapping an earlier cell on the trail cuts the path back to it.
    if (head && !sameCell(head, cell) && cellIndex(localPath, cell) >= 0) {
      backtrackTo(cell);
      return;
    }
    // Otherwise a drag only starts from a blank board, or resumes exactly from the current head.
    if (localPath.length > 0 && !(head && sameCell(head, cell))) return;
    gridRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    lastHitRef.current = null;
    handleAt(cell.row, cell.col);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell) handleAt(cell.row, cell.col);
  };

  const endDrag = () => {
    setDragging(false);
    lastHitRef.current = null;
  };

  if (isLoading || !entry) {
    return (
      <GameShell slug="pathway" icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell slug="pathway" icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <p className="text-center text-fg-subtle">
          No Pathway puzzle is available today. Check back soon!
        </p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell slug="pathway" icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (view.complete) {
    return (
      <GameShell slug="pathway" icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <ResultScreen
          gameName="Pathway"
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

  const { size, checkpoints, walls } = view;
  const nextCheckpoint = highestCheckpointInPath(localPath, checkpoints) + 1;
  const cells: Cell[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) cells.push({ row, col });
  }

  return (
    <GameShell
      slug="pathway"
      showRulesOnFirstVisit
      icon={<GameIcon slug="pathway" size="lg" />}
      title="Pathway"
      subtitle="Draw one line through every cell, in number order."
      headerRight={
        <HudChip label="Cells">
          <span className="tabular font-mono text-sm text-white/85">
            {localPath.length}
            <span className="text-fg-subtle">/{size * size}</span>
          </span>
        </HudChip>
      }
    >
      <div
        ref={gridRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onBoardKeyDown}
        tabIndex={0}
        role="application"
        aria-label={`Pathway board, ${size} by ${size}. Arrow keys draw from the end of your path, Backspace steps back.`}
        aria-describedby="pathway-progress"
        className="relative mx-auto aspect-square w-full max-w-[26rem] touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950"
      >
        <div
          className="absolute inset-0 grid overflow-hidden rounded-2xl border border-white/[0.12] bg-ink-900/90 shadow-[0_24px_48px_-24px_var(--shadow-deep)]"
          // Both axes: with rows left to size themselves, the last row came out shorter.
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => {
            const checkpointIdx = cellIndex(checkpoints, cell);
            const onPath = localPath.some((c) => sameCell(c, cell));
            const isHead = localPath.length > 0 && sameCell(localPath[localPath.length - 1]!, cell);
            const isBlocked = blockedCell !== null && sameCell(blockedCell, cell);
            const isHintTarget = hintSuggestion !== null && sameCell(hintSuggestion.cell, cell);
            const wallRight =
              cell.col + 1 < size && hasWall(walls, cell, { row: cell.row, col: cell.col + 1 });
            const wallBottom =
              cell.row + 1 < size && hasWall(walls, cell, { row: cell.row + 1, col: cell.col });
            const wallLeft =
              cell.col > 0 && hasWall(walls, cell, { row: cell.row, col: cell.col - 1 });
            const wallTop =
              cell.row > 0 && hasWall(walls, cell, { row: cell.row - 1, col: cell.col });
            return (
              <div
                key={`${cell.row}-${cell.col}`}
                data-row={cell.row}
                data-col={cell.col}
                className={`relative flex items-center justify-center border border-white/[0.06] font-display text-lg font-bold transition-colors ${
                  isBlocked
                    ? "bg-rose-500/30 text-rose-100"
                    : onPath
                      ? isHead
                        ? "bg-brand-500 text-on-accent"
                        : "bg-brand-600/45 text-on-accent"
                      : "text-white/70"
                } ${wallTop ? "border-t-4 border-t-white/85" : ""} ${wallRight ? "border-r-4 border-r-white/85" : ""} ${
                  wallBottom ? "border-b-4 border-b-white/85" : ""
                } ${wallLeft ? "border-l-4 border-l-white/85" : ""} ${isHintTarget ? "ring-2 ring-inset ring-amber-300" : ""}`}
              >
                {checkpointIdx >= 0 ? (
                  <span
                    className={`flex h-2/3 w-2/3 items-center justify-center rounded-full font-mono text-base font-semibold ${
                      onPath
                        ? "bg-on-accent text-brand-700 shadow-[0_0_14px_rgb(255_255_255/0.45)]"
                        : "border border-accent-400/50 bg-accent-400/10 text-accent-100 shadow-[0_0_12px_-2px_rgb(34_211_238/0.6)]"
                    }`}
                  >
                    {checkpointIdx + 1}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polyline
            points={localPath.map((c) => `${c.col + 0.5},${c.row + 0.5}`).join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-white/90"
            strokeWidth="0.08"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {hintSuggestion ? (
        <div className="animate-pop-in mx-auto flex max-w-sm flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
          <Icon name="lightbulb" className="text-lg" filled />
          {hintSuggestion.kind === "extend"
            ? `Next, go to row ${hintSuggestion.cell.row + 1}, column ${hintSuggestion.cell.col + 1}.`
            : `Your path can't be finished from here — back up to row ${hintSuggestion.cell.row + 1}, column ${
                hintSuggestion.cell.col + 1
              }.`}
          <Button size="sm" variant="secondary" onClick={acceptHint}>
            {hintSuggestion.kind === "extend" ? "Draw it" : "Back up"}
          </Button>
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

      <div className="flex justify-center">
        <Button
          variant="secondary"
          size="sm"
          isLoading={hint.isPending}
          disabled={!!hintSuggestion}
          onClick={() => void requestHint()}
          title={`Each new hint costs ${SCORE.HINT_PENALTY} points`}
        >
          <Icon name="lightbulb" className="text-lg" /> Hint{" "}
          <span className="text-xs font-medium text-amber-300">−{SCORE.HINT_PENALTY}</span>{" "}
          <span className="sr-only">(costs {SCORE.HINT_PENALTY} points)</span>
        </Button>
      </div>

      <p id="pathway-progress" className="sr-only" aria-live="polite">
        {localPath.length} of {size * size} cells filled
        {nextCheckpoint <= checkpoints.length ? `, next number ${nextCheckpoint}` : ""}.
      </p>

      <p className="mx-auto max-w-md text-center text-xs text-fg-subtle">
        Press and drag from 1, through every cell, ending on {checkpoints.length}. Tap a cell on
        your trail to back up to it. On a keyboard, use the arrow keys and Backspace.
      </p>
    </GameShell>
  );
}
