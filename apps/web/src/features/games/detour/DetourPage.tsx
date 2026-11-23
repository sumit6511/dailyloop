import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { GameIcon } from "../../../components/GameIcon";
import { Button } from "../../../components/Button";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Icon } from "../../../components/Icon";
import { getShowRoutes, setShowRoutes as persistShowRoutes } from "./settings";

interface Cell {
  row: number;
  col: number;
}

type Orientation = "h" | "v";
type Owner = "player" | "bot" | "stone";

interface Wall {
  orientation: Orientation;
  row: number;
  col: number;
}

interface PlacedWall extends Wall {
  owner: Owner;
}

type Action = ({ type: "step" } & Cell) | ({ type: "wall" } & Wall);
type Move = Action | { type: "resign" };

interface DetourView {
  size: number;
  wallsEach: number;
  walls: PlacedWall[];
  player: Cell;
  bot: Cell;
  wallsLeft: { player: number; bot: number };
  playerRoute: Cell[];
  botRoute: Cell[];
  legalSteps: Cell[];
  legalWalls: string[];
  lastTurn: { player: Move; bot: Action | null } | null;
  turns: number;
  complete: boolean;
  won?: boolean;
  resigned?: boolean;
  wallsUsed?: number;
  playerDistance?: number;
  botDistance?: number;
}

// Board geometry in SVG user units: square cells separated by grooves the walls sit in.
const CELL = 10;
const GAP = 2.6;
const PITCH = CELL + GAP;
const PAD = 1.5;
/** Long enough that the bot's reply reads as a reply, short enough to never feel like lag. */
const BOT_REPLY_DELAY_MS = 420;

const wallKey = (w: Wall) => `${w.orientation}${w.row}-${w.col}`;
const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const cellCentre = (c: Cell) => ({ x: c.col * PITCH + CELL / 2, y: c.row * PITCH + CELL / 2 });

function wallRect(wall: Wall) {
  if (wall.orientation === "h") {
    return { x: wall.col * PITCH, y: wall.row * PITCH + CELL, width: 2 * CELL + GAP, height: GAP };
  }
  return { x: wall.col * PITCH + CELL, y: wall.row * PITCH, width: GAP, height: 2 * CELL + GAP };
}

const WALL_FILL: Record<Owner, string> = {
  stone: "fill-slate-300/70",
  player: "fill-brand-400",
  bot: "fill-sky-400",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** What the board looks like the instant the player acts, before the server (and bot) answer. */
function optimistic(view: DetourView, action: Action): DetourView {
  const base = { ...view, legalSteps: [], legalWalls: [], lastTurn: null };
  if (action.type === "step") return { ...base, player: { row: action.row, col: action.col } };
  return {
    ...base,
    walls: [
      ...view.walls,
      { orientation: action.orientation, row: action.row, col: action.col, owner: "player" },
    ],
    wallsLeft: { ...view.wallsLeft, player: view.wallsLeft.player - 1 },
  };
}

interface BoardProps {
  view: DetourView;
  interactive: boolean;
  mode: "move" | "wall";
  orientation: Orientation;
  showRoutes: boolean;
  onStep?: (cell: Cell) => void;
  onWall?: (wall: Wall) => void;
}

function Board({ view, interactive, mode, orientation, showRoutes, onStep, onWall }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverSlot, setHoverSlot] = useState<Cell | null>(null);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const { size } = view;
  const span = size * CELL + (size - 1) * GAP;
  const legalWalls = new Set(view.legalWalls);
  const lastBotWall = view.lastTurn?.bot?.type === "wall" ? wallKey(view.lastTurn.bot) : null;

  useEffect(() => {
    setArmedKey(null);
  }, [view, mode, orientation]);

  const slotAt = (clientX: number, clientY: number): Cell | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const total = span + PAD * 2;
    const x = ((clientX - rect.left) / rect.width) * total - PAD;
    const y = ((clientY - rect.top) / rect.height) * total - PAD;
    const clamp = (n: number) => Math.max(0, Math.min(size - 2, n));
    return {
      row: clamp(Math.round((y - CELL - GAP / 2) / PITCH)),
      col: clamp(Math.round((x - CELL - GAP / 2) / PITCH)),
    };
  };

  const wallMode = interactive && mode === "wall";
  const preview: Wall | null = wallMode && hoverSlot ? { orientation, ...hoverSlot } : null;
  const previewLegal = preview ? legalWalls.has(wallKey(preview)) : false;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!wallMode || event.pointerType === "touch") return;
    setHoverSlot(slotAt(event.clientX, event.clientY));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!wallMode) return;
    const slot = slotAt(event.clientX, event.clientY);
    if (!slot) return;
    const wall = { orientation, ...slot };
    const key = wallKey(wall);
    // Touch has no hover, so the first tap previews and a second tap on the same slot places.
    if (event.pointerType === "touch" && armedKey !== key) {
      setHoverSlot(slot);
      setArmedKey(key);
      return;
    }
    if (legalWalls.has(key)) onWall?.(wall);
  };

  const cells: Cell[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) cells.push({ row, col });
  const routePoints = (route: Cell[]) =>
    route
      .map((c) => {
        const { x, y } = cellCentre(c);
        return `${x},${y}`;
      })
      .join(" ");
  const player = cellCentre(view.player);
  const bot = cellCentre(view.bot);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <svg
        ref={svgRef}
        viewBox={`${-PAD} ${-PAD} ${span + PAD * 2} ${span + PAD * 2}`}
        className={`block aspect-square w-full touch-manipulation select-none ${wallMode ? "cursor-crosshair" : ""}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => wallMode && !armedKey && setHoverSlot(null)}
        onPointerUp={onPointerUp}
        role="img"
        aria-label={`Detour board, ${size} by ${size}`}
      >
        {cells.map((cell) => {
          const goal =
            cell.row === 0
              ? "fill-brand-500/[0.14]"
              : cell.row === size - 1
                ? "fill-sky-500/[0.12]"
                : "fill-white/[0.05]";
          return (
            <rect
              key={`c${cell.row}-${cell.col}`}
              x={cell.col * PITCH}
              y={cell.row * PITCH}
              width={CELL}
              height={CELL}
              rx={1.8}
              className={goal}
            />
          );
        })}

        {showRoutes ? (
          <g
            className="pointer-events-none"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Nudged apart diagonally so a stretch both routes share reads as two lanes, not one. */}
            <polyline
              points={routePoints(view.botRoute)}
              transform="translate(0.9 0.9)"
              className="stroke-sky-300/75"
              strokeWidth={1.1}
              strokeDasharray="0.1 2.2"
            />
            <polyline
              points={routePoints(view.playerRoute)}
              transform="translate(-0.9 -0.9)"
              className="stroke-brand-300/90"
              strokeWidth={1.1}
              strokeDasharray="0.1 2.2"
            />
          </g>
        ) : null}

        {interactive && mode === "move"
          ? view.legalSteps.map((step) => {
              const { x, y } = cellCentre(step);
              const label = `Move to row ${step.row + 1}, column ${step.col + 1}`;
              const activate = () => onStep?.(step);
              return (
                <g
                  key={`s${step.row}-${step.col}`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  className="group cursor-pointer outline-none"
                  onClick={activate}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate();
                    }
                  }}
                >
                  <rect
                    x={step.col * PITCH}
                    y={step.row * PITCH}
                    width={CELL}
                    height={CELL}
                    rx={1.8}
                    className="fill-brand-500/[0.12] stroke-brand-400/40 transition-colors group-hover:fill-brand-500/30 group-focus-visible:stroke-white"
                    strokeWidth={0.4}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={1.4}
                    className="fill-brand-300/80 transition-transform group-hover:scale-125"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                </g>
              );
            })
          : null}

        {view.walls.map((wall) => {
          const key = wallKey(wall);
          return (
            <rect
              key={key}
              {...wallRect(wall)}
              rx={GAP / 2}
              className={`${WALL_FILL[wall.owner]} ${key === lastBotWall ? "animate-pop-in" : ""}`}
              style={
                key === lastBotWall
                  ? { transformOrigin: "center", transformBox: "fill-box" }
                  : undefined
              }
            />
          );
        })}

        {preview ? (
          <rect
            {...wallRect(preview)}
            rx={GAP / 2}
            className={`pointer-events-none ${previewLegal ? "fill-emerald-400/70" : "fill-rose-500/50"}`}
          />
        ) : null}

        <g className="pointer-events-none">
          <g
            style={{ transform: `translate(${bot.x}px, ${bot.y}px)` }}
            className="transition-transform duration-300 ease-out"
          >
            <circle r={3.7} className="fill-sky-400" />
            <circle r={3.7} className="fill-none stroke-sky-100/70" strokeWidth={0.6} />
            <circle r={1.1} className="fill-sky-950/60" />
          </g>
          <g
            style={{ transform: `translate(${player.x}px, ${player.y}px)` }}
            className="transition-transform duration-300 ease-out"
          >
            <circle r={3.7} className="fill-brand-500" />
            <circle r={3.7} className="fill-none stroke-white/80" strokeWidth={0.6} />
            <circle r={1.1} className="fill-white/90" />
          </g>
        </g>
      </svg>

      {wallMode && armedKey ? (
        <p className="pointer-events-none absolute inset-x-0 -bottom-6 text-center text-xs text-white/50">
          {previewLegal
            ? "Tap again to place"
            : "Can't go there — it overlaps a wall or seals a route"}
        </p>
      ) : null}
    </div>
  );
}

function RacerCard({
  who,
  steps,
  walls,
  wallsEach,
  active,
}: {
  who: "player" | "bot";
  steps: number;
  walls: number;
  wallsEach: number;
  active: boolean;
}) {
  const isPlayer = who === "player";
  return (
    <div
      className={`glass-subtle flex flex-1 items-center gap-3 rounded-xl px-3 py-2 transition-shadow ${
        active ? (isPlayer ? "ring-1 ring-brand-400/60" : "ring-1 ring-sky-400/60") : ""
      }`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full ${isPlayer ? "bg-brand-500 ring-2 ring-white/70" : "bg-sky-400 ring-2 ring-sky-100/60"}`}
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{isPlayer ? "You" : "Bot"}</div>
        <div className="text-xs text-white/50">{plural(steps, "step")} to go</div>
      </div>
      <div className="ml-auto flex gap-0.5" aria-label={`${walls} of ${wallsEach} walls left`}>
        {Array.from({ length: wallsEach }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-1.5 rounded-full ${i < walls ? (isPlayer ? "bg-brand-400" : "bg-sky-400") : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="mx-auto aspect-square w-full max-w-sm">
      <Skeleton shape="block" className="h-full w-full" />
    </div>
  );
}

function statusLine(view: DetourView, thinking: boolean): string {
  if (thinking) return "Bot is thinking…";
  const you = view.playerRoute.length - 1;
  const them = view.botRoute.length - 1;
  const bot = view.lastTurn?.bot;
  const lead =
    bot?.type === "wall" ? "The bot dropped a wall. " : bot ? "The bot moved. " : "You go first. ";
  // The player is to move, so in a straight race they arrive first unless their route is longer.
  if (you <= them) return `${lead}You're ahead in the race.`;
  return `${lead}The bot is ahead by ${plural(you - them, "step")} — a wall could swing it.`;
}

export function DetourPage() {
  const { data: entry, isLoading } = useGameToday("detour");
  const submitMove = useSubmitMove("detour");
  const [localView, setLocalView] = useState<DetourView | null>(null);
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<"move" | "wall">("move");
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [showRoutes, setShowRoutes] = useState(getShowRoutes);
  const [confirmResign, setConfirmResign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);

  useAutoStartAttempt("detour", entry?.status);

  const serverView = (entry?.content ?? null) as DetourView | null;
  const view = localView ?? serverView;

  // Fall back to the server's copy once it has caught up with (or moved past) the local one.
  useEffect(() => {
    if (thinking || !localView || !serverView) return;
    if (serverView.turns >= localView.turns || serverView.complete) setLocalView(null);
  }, [serverView, localView, thinking]);

  const send = async (move: Move) => {
    if (!view || thinking) return;
    setError(null);
    if (move.type !== "resign") setLocalView(optimistic(view, move));
    setThinking(true);
    const started = Date.now();
    try {
      const response = await submitMove.mutateAsync(move);
      const wait = BOT_REPLY_DELAY_MS - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      setLocalView(response.content as DetourView);
      if (response.complete) setFinalScore(response.score ?? null);
      if (response.newlyUnlockedAchievements?.length)
        setNewAchievements(response.newlyUnlockedAchievements);
    } catch {
      setLocalView(null);
      setError("Couldn't reach the server — your move wasn't played. Try again.");
    } finally {
      setThinking(false);
    }
  };

  const toggleRoutes = () => {
    setShowRoutes((current) => {
      persistShowRoutes(!current);
      return !current;
    });
  };

  // Keyboard: arrows step (jumping when the bot is in the way), W toggles wall mode, R rotates.
  useEffect(() => {
    if (!view || view.complete) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "r") {
        setOrientation((o) => (o === "h" ? "v" : "h"));
        return;
      }
      if (key === "w") {
        setMode((m) => (m === "move" ? "wall" : "move"));
        return;
      }
      const delta: Record<string, Cell> = {
        arrowup: { row: -1, col: 0 },
        arrowdown: { row: 1, col: 0 },
        arrowleft: { row: 0, col: -1 },
        arrowright: { row: 0, col: 1 },
      };
      const d = delta[key];
      if (!d || thinking) return;
      const near = { row: view.player.row + d.row, col: view.player.col + d.col };
      const far = { row: near.row + d.row, col: near.col + d.col };
      const target =
        view.legalSteps.find((s) => sameCell(s, near)) ??
        view.legalSteps.find((s) => sameCell(s, far));
      if (target) {
        event.preventDefault();
        void send({ type: "step", ...target });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const shell = (children: ReactNode, subtitle?: string, headerRight?: ReactNode) => (
    <GameShell
      icon={<GameIcon slug="detour" size="lg" />}
      title="Detour"
      subtitle={subtitle}
      headerRight={headerRight}
    >
      {children}
    </GameShell>
  );

  if (isLoading || !entry)
    return shell(
      <div className="py-4">
        <BoardSkeleton />
      </div>,
    );
  if (!entry.available) {
    return shell(
      <p className="text-center text-white/50">
        No Detour board is available today. Check back soon!
      </p>,
    );
  }
  if (!view)
    return shell(
      <div className="py-4">
        <BoardSkeleton />
      </div>,
    );

  if (view.complete) {
    const won = !!view.won;
    const stats = [
      { label: "Turns", value: String(view.turns) },
      { label: "Walls used", value: `${view.wallsUsed ?? 0}/${view.wallsEach}` },
    ];
    if (won) stats.push({ label: "Won by", value: plural(view.botDistance ?? 0, "step") });
    else if (!view.resigned)
      stats.push({ label: "Short by", value: plural(view.playerDistance ?? 0, "step") });
    return shell(
      <ResultScreen
        gameName="Detour"
        won={won}
        score={entry.score ?? finalScore ?? 0}
        stats={stats}
        newAchievementKeys={newAchievements}
      >
        <div className="mb-6">
          <p className="mb-3 text-sm text-white/60">
            {won
              ? "You crossed first."
              : view.resigned
                ? "You resigned."
                : "The bot got there first."}
          </p>
          <div className="mx-auto max-w-[16rem]">
            <Board view={view} interactive={false} mode="move" orientation="h" showRoutes={false} />
          </div>
        </div>
      </ResultScreen>,
    );
  }

  const playable = !thinking;
  const you = view.playerRoute.length - 1;
  const them = view.botRoute.length - 1;

  return shell(
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <RacerCard
          who="player"
          steps={you}
          walls={view.wallsLeft.player}
          wallsEach={view.wallsEach}
          active={!thinking}
        />
        <RacerCard
          who="bot"
          steps={them}
          walls={view.wallsLeft.bot}
          wallsEach={view.wallsEach}
          active={thinking}
        />
      </div>

      <p className="text-center text-sm text-white/60" aria-live="polite">
        {statusLine(view, thinking)}
      </p>

      <Board
        view={view}
        interactive={playable}
        mode={mode}
        orientation={orientation}
        showRoutes={showRoutes}
        onStep={(cell) => void send({ type: "step", ...cell })}
        onWall={(wall) => void send({ type: "wall", ...wall })}
      />

      {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <div className="glass-subtle inline-flex rounded-xl p-1" role="group" aria-label="Action">
          <button
            type="button"
            onClick={() => setMode("move")}
            aria-pressed={mode === "move"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === "move" ? "bg-brand-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            <Icon name="directions_walk" className="text-lg" /> Move
          </button>
          <button
            type="button"
            onClick={() => setMode("wall")}
            disabled={view.wallsLeft.player === 0}
            aria-pressed={mode === "wall"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "wall" ? "bg-brand-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            <Icon name="fence" className="text-lg" /> Wall
          </button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
          disabled={mode !== "wall"}
          aria-label={`Wall direction: ${orientation === "h" ? "horizontal" : "vertical"}. Press to rotate.`}
        >
          <Icon name="rotate_90_degrees_cw" className="text-lg" />
          {orientation === "h" ? "Horizontal" : "Vertical"}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleRoutes} aria-pressed={showRoutes}>
          <Icon name={showRoutes ? "visibility" : "visibility_off"} className="text-lg" /> Routes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmResign(true)}
          disabled={thinking}
        >
          <Icon name="flag" className="text-lg" /> Resign
        </Button>
      </div>

      <details className="glass-subtle rounded-xl px-4 py-3 text-sm text-white/60">
        <summary className="cursor-pointer font-semibold text-white/80">How to play</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Get your pawn to the top row before the bot reaches the bottom. You move first.</li>
          <li>Each turn, either step one square or place one of your {view.wallsEach} walls.</li>
          <li>
            Walls are two squares long and block both of you. They can't overlap, and can never seal
            anyone off completely.
          </li>
          <li>
            Face to face with the bot? Jump straight over it — or diagonally, if a wall is behind
            it.
          </li>
          <li>
            Grey walls are today's fixed layout. Dotted lines show each racer's shortest route.
          </li>
          <li className="hidden sm:list-item">
            Keyboard: arrows to move, W to switch to walls, R to rotate.
          </li>
        </ul>
      </details>

      <ConfirmDialog
        open={confirmResign}
        title="Resign today's race?"
        body="The bot wins and the game ends — you can't replay today's board."
        confirmLabel="Resign"
        danger
        onConfirm={() => {
          setConfirmResign(false);
          void send({ type: "resign" });
        }}
        onCancel={() => setConfirmResign(false)}
      />
    </>,
    `Reach the top before the bot reaches the bottom. Turn ${view.turns + 1}.`,
  );
}
