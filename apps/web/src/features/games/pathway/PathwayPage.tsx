import { useEffect, useRef, useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { GameIcon } from "../../../components/GameIcon";

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

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function cellIndex(cells: Cell[], target: Cell): number {
  return cells.findIndex((c) => sameCell(c, target));
}

function hasWall(walls: Wall[], a: Cell, b: Cell): boolean {
  return walls.some((w) => (sameCell(w.a, a) && sameCell(w.b, b)) || (sameCell(w.a, b) && sameCell(w.b, a)));
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
    if (checkpointNumber === view.checkpoints.length && path.length + 1 !== view.size * view.size) return null;
  }

  return [...path, move];
}

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
  const [localPath, setLocalPath] = useState<Cell[]>([]);
  const [dragging, setDragging] = useState(false);
  const [blockedCell, setBlockedCell] = useState<Cell | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastHitRef = useRef<Cell | null>(null);
  const queueRef = useRef<Cell[]>([]);
  const processingRef = useRef(false);

  useAutoStartAttempt("pathway", entry?.status);

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
    // Only starts a drag from a blank board, or resumes exactly from the current head.
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
      <GameShell icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <p className="text-center text-white/50">No Pathway puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (view.complete) {
    return (
      <GameShell icon={<GameIcon slug="pathway" size="lg" />} title="Pathway">
        <ResultScreen
          gameName="Pathway"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Mistakes", value: String(view.mistakes ?? 0) }]}
          newAchievementKeys={newAchievements}
        />
      </GameShell>
    );
  }

  const { size, checkpoints, walls } = view;
  const cells: Cell[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) cells.push({ row, col });
  }

  return (
    <GameShell icon={<GameIcon slug="pathway" size="lg" />} title="Pathway" subtitle="Draw one line through every cell, in number order.">
      <div
        ref={gridRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto aspect-square w-full max-w-sm touch-none select-none"
      >
        <div className="glass-subtle absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {cells.map((cell) => {
            const checkpointIdx = cellIndex(checkpoints, cell);
            const onPath = localPath.some((c) => sameCell(c, cell));
            const isHead = localPath.length > 0 && sameCell(localPath[localPath.length - 1]!, cell);
            const isBlocked = blockedCell !== null && sameCell(blockedCell, cell);
            const wallRight = cell.col + 1 < size && hasWall(walls, cell, { row: cell.row, col: cell.col + 1 });
            const wallBottom = cell.row + 1 < size && hasWall(walls, cell, { row: cell.row + 1, col: cell.col });
            const wallLeft = cell.col > 0 && hasWall(walls, cell, { row: cell.row, col: cell.col - 1 });
            const wallTop = cell.row > 0 && hasWall(walls, cell, { row: cell.row - 1, col: cell.col });
            return (
              <div
                key={`${cell.row}-${cell.col}`}
                data-row={cell.row}
                data-col={cell.col}
                className={`relative flex items-center justify-center border border-white/[0.08] text-lg font-bold transition-colors ${
                  isBlocked
                    ? "bg-rose-500/30 text-rose-100"
                    : onPath
                      ? isHead
                        ? "bg-brand-500 text-white"
                        : "bg-brand-600/60 text-white"
                      : "text-white/70"
                } ${wallTop ? "border-t-4 border-t-amber-400" : ""} ${wallRight ? "border-r-4 border-r-amber-400" : ""} ${
                  wallBottom ? "border-b-4 border-b-amber-400" : ""
                } ${wallLeft ? "border-l-4 border-l-amber-400" : ""}`}
              >
                {checkpointIdx >= 0 ? (
                  <span
                    className={`flex h-2/3 w-2/3 items-center justify-center rounded-full text-base font-bold ${
                      onPath ? "bg-white/25" : "bg-white/[0.08] text-white/90"
                    }`}
                  >
                    {checkpointIdx + 1}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={localPath.map((c) => `${c.col + 0.5},${c.row + 0.5}`).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.06"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="mt-4 text-center text-xs text-white/40">
        Press and drag from 1, through every cell, ending on {checkpoints.length}. Drag back over your trail to
        retreat, or back to 1 to start over.
      </p>
    </GameShell>
  );
}
