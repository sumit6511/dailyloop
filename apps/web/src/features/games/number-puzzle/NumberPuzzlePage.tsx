import { useState } from "react";
import {
  useGameToday,
  useAutoStartAttempt,
  useSubmitMove,
  useUndoMove,
} from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { Skeleton } from "../../../components/Skeleton";
import { GameTile } from "../../../components/GameTile";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { ApiClientError } from "../../../lib/api-client";
import { useToast } from "../../../lib/toast-context";

interface NumberPuzzleStep {
  a: number;
  b: number;
  op: string;
  result: number;
}

interface NumberPuzzleView {
  numbers: number[];
  target: number;
  pool: number[];
  steps: NumberPuzzleStep[];
  complete: boolean;
  won?: boolean;
  /** One way to reach the target — only sent once the attempt is complete. */
  solution?: string;
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Skeleton className="h-10 w-24" />
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} shape="block" className="h-14 w-14 sm:h-16 sm:w-16" />
        ))}
      </div>
    </div>
  );
}

const OPS = ["+", "-", "*", "/"] as const;
const OP_SYMBOLS: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const OP_NAMES: Record<string, string> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
};
const MERGE_MS = 380;
const CELEBRATE_MS = 700;

export function NumberPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("number-puzzle");
  const submitMove = useSubmitMove("number-puzzle");
  const undoMove = useUndoMove("number-puzzle");
  const { showToast } = useToast();
  const [firstIndex, setFirstIndex] = useState<number | null>(null);
  const [op, setOp] = useState<(typeof OPS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [combiningIndices, setCombiningIndices] = useState<number[] | null>(null);
  const [frozenPool, setFrozenPool] = useState<number[] | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);

  useAutoStartAttempt("number-puzzle", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell
        slug="number-puzzle"
        icon={<GameIcon slug="number-puzzle" size="lg" />}
        title="Number Puzzle"
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
        slug="number-puzzle"
        icon={<GameIcon slug="number-puzzle" size="lg" />}
        title="Number Puzzle"
      >
        <p className="text-center text-fg-subtle">
          No Number Puzzle is available today. Check back soon!
        </p>
      </GameShell>
    );
  }

  const view = entry.content as NumberPuzzleView | null;
  if (!view) {
    return (
      <GameShell
        slug="number-puzzle"
        icon={<GameIcon slug="number-puzzle" size="lg" />}
        title="Number Puzzle"
      >
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  const resetSelection = () => {
    setFirstIndex(null);
    setOp(null);
  };

  const selectNumber = async (index: number) => {
    if (view.complete || combiningIndices) return;
    if (firstIndex === null) {
      setFirstIndex(index);
      return;
    }
    if (index === firstIndex) {
      resetSelection();
      return;
    }
    if (op === null) return;

    const a = view.pool[firstIndex]!;
    const b = view.pool[index]!;
    const poolSizeBefore = view.pool.length;
    setError(null);
    setCombiningIndices([firstIndex, index]);
    setFrozenPool(view.pool);
    resetSelection();
    const startedAt = Date.now();
    try {
      const response = await submitMove.mutateAsync({ type: "combine", a, b, op });
      const newView = response.content as NumberPuzzleView;
      if (newView.pool.length === poolSizeBefore) {
        setError("That combination isn't allowed — the result must be a positive whole number.");
      }
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
    const remaining = Math.max(0, MERGE_MS - (Date.now() - startedAt));
    setTimeout(() => {
      setCombiningIndices(null);
      setFrozenPool(null);
    }, remaining);
  };

  const undoLastStep = async () => {
    if (view.steps.length === 0 || combiningIndices || undoMove.isPending) return;
    setError(null);
    resetSelection();
    try {
      await undoMove.mutateAsync();
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't undo that step", "error");
    }
  };

  const resetPuzzle = async () => {
    if (view.steps.length === 0 || combiningIndices || undoMove.isPending) return;
    setError(null);
    resetSelection();
    try {
      // Undo one step at a time — there's no dedicated "reset" endpoint, and undo is already
      // proven safe for this game (unlike Logic Puzzle, Number Puzzle doesn't track mistakes,
      // so replaying undo repeatedly can't be used to erase a scoring penalty).
      let stepsLeft = view.steps.length;
      while (stepsLeft > 0) {
        const response = await undoMove.mutateAsync();
        stepsLeft = (response.content as NumberPuzzleView).steps.length;
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Couldn't reset the puzzle", "error");
    }
  };

  // Submitting ends today's puzzle for good, so only do it straight away once the target is on the
  // board. Before that, a stray tap would forfeit the day: ask first.
  const requestSubmit = () => {
    if (view.pool.includes(view.target)) void submitFinal();
    else setConfirmingGiveUp(true);
  };

  const submitFinal = async () => {
    setConfirmingGiveUp(false);
    setError(null);
    try {
      const response = await submitMove.mutateAsync({ type: "submit" });
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
      if ((response.content as NumberPuzzleView).won) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

  const showResult = view.complete && !celebrating;

  if (showResult) {
    return (
      <GameShell
        slug="number-puzzle"
        icon={<GameIcon slug="number-puzzle" size="lg" />}
        title="Number Puzzle"
      >
        <ResultScreen
          gameName="Number Puzzle"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Steps", value: String(view.steps.length) }]}
          newAchievementKeys={newAchievements}
        >
          {!view.won ? (
            <p className="mb-6 text-sm text-fg-muted">
              Target was {view.target}. Final numbers: {view.pool.join(", ")}
              {view.solution ? (
                <>
                  <br />
                  One way to get there:{" "}
                  <span className="font-semibold text-white/80">
                    {view.solution} = {view.target}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell
      slug="number-puzzle"
      showRulesOnFirstVisit
      icon={<GameIcon slug="number-puzzle" size="lg" />}
      title="Number Puzzle"
      subtitle={`Reach ${view.target} using the numbers below.`}
    >
      <section className="glass-subtle relative mx-auto flex w-full max-w-md flex-col items-center gap-6 overflow-hidden px-4 py-7 sm:px-6">
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative text-center">
          <div className="eyebrow text-fg-subtle">Target</div>
          <div className="relative mt-1 inline-flex items-center justify-center">
            {celebrating ? (
              <div
                className="animate-glow-pulse absolute inset-0 -z-10 rounded-full bg-emerald-500/50 blur-xl"
                aria-hidden="true"
              />
            ) : null}
            <div
              className={`tabular font-mono text-5xl font-semibold transition-colors sm:text-6xl ${
                celebrating
                  ? "text-emerald-300"
                  : "text-accent-200 drop-shadow-[0_0_18px_rgb(34_211_238/0.45)]"
              }`}
            >
              {view.target}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
          {(frozenPool ?? view.pool).map((num, i) => {
            const isCombining = combiningIndices?.includes(i);
            const state = isCombining ? "correct" : firstIndex === i ? "selected" : "default";
            return (
              <GameTile
                key={i}
                state={state}
                size="lg"
                className="font-mono"
                onClick={() => void selectNumber(i)}
                disabled={!!combiningIndices}
              >
                {num}
              </GameTile>
            );
          })}
        </div>

        <div className="flex justify-center gap-2 sm:gap-2.5">
          {OPS.map((o) => (
            <GameTile
              key={o}
              state={op === o ? "selected" : firstIndex === null ? "disabled" : "default"}
              size="md"
              className="text-2xl sm:text-3xl"
              onClick={() => setOp(o)}
              disabled={firstIndex === null}
              aria-label={OP_NAMES[o]}
            >
              {OP_SYMBOLS[o]}
            </GameTile>
          ))}
        </div>

        {view.steps.length > 0 ? (
          <div className="flex w-full flex-col items-center gap-3 border-t border-white/[0.06] pt-5">
            <ol className="flex flex-col gap-1 text-center font-mono text-sm text-fg-subtle">
              {view.steps.map((step, i) => (
                <li key={i} className="animate-pop-in tabular">
                  {step.a} {OP_SYMBOLS[step.op]} {step.b} ={" "}
                  <span className="font-semibold text-white/85">{step.result}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                isLoading={undoMove.isPending}
                disabled={!!combiningIndices}
                onClick={() => void undoLastStep()}
              >
                <Icon name="undo" className="text-base" /> Undo last step
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!!combiningIndices || undoMove.isPending}
                onClick={() => void resetPuzzle()}
              >
                <Icon name="restart_alt" className="text-base" /> Reset
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-center text-sm font-medium text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-xs text-fg-subtle">
          Tap a number, tap an operator, then tap a second number to combine them.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={resetSelection}
            disabled={firstIndex === null && op === null}
          >
            <Icon name="close" className="text-lg" /> Clear selection
          </Button>
          <Button onClick={requestSubmit} isLoading={submitMove.isPending}>
            <Icon name="check" className="text-lg" /> Submit answer
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingGiveUp}
        title={`You haven't made ${view.target} yet`}
        body="Submitting now ends today's puzzle as a loss, and you'll see one way to solve it. Keep trying?"
        confirmLabel="Give up"
        cancelLabel="Keep playing"
        danger
        confirmIcon="flag"
        isLoading={submitMove.isPending}
        onConfirm={() => void submitFinal()}
        onCancel={() => setConfirmingGiveUp(false)}
      />
    </GameShell>
  );
}
