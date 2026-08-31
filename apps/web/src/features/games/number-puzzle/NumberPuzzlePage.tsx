import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove, useUndoMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { Spinner } from "../../../components/Spinner";
import { GameTile } from "../../../components/GameTile";
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
}

const OPS = ["+", "-", "*", "/"] as const;
const OP_SYMBOLS: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
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

  useAutoStartAttempt("number-puzzle", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell icon="🔢" title="Number Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon="🔢" title="Number Puzzle">
        <p className="text-center text-white/50">No Number Puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  const view = entry.content as NumberPuzzleView | null;
  if (!view) {
    return (
      <GameShell icon="🔢" title="Number Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
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

  const submitFinal = async () => {
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
      <GameShell icon="🔢" title="Number Puzzle">
        <ResultScreen
          gameName="Number Puzzle"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Steps", value: String(view.steps.length) }]}
          newAchievementKeys={newAchievements}
        >
          {!view.won ? (
            <p className="mb-6 text-sm text-white/60">
              Target was {view.target}. Final numbers: {view.pool.join(", ")}
            </p>
          ) : null}
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell icon="🔢" title="Number Puzzle" subtitle={`Reach ${view.target} using the numbers below.`}>
      <div className="mb-6 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-white/50">Target</div>
        <div className="relative inline-flex items-center justify-center">
          {celebrating ? (
            <div className="animate-glow-pulse absolute inset-0 -z-10 rounded-full bg-emerald-500/50 blur-xl" aria-hidden="true" />
          ) : null}
          <div className={`text-4xl font-bold transition-colors ${celebrating ? "text-emerald-300" : "text-brand-300"}`}>
            {view.target}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {(frozenPool ?? view.pool).map((num, i) => {
          const isCombining = combiningIndices?.includes(i);
          const state = isCombining ? "correct" : firstIndex === i ? "selected" : "default";
          return (
            <GameTile key={i} state={state} size="lg" onClick={() => void selectNumber(i)} disabled={!!combiningIndices}>
              {num}
            </GameTile>
          );
        })}
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {OPS.map((o) => (
          <GameTile
            key={o}
            state={op === o ? "selected" : firstIndex === null ? "disabled" : "default"}
            size="sm"
            onClick={() => setOp(o)}
            disabled={firstIndex === null}
          >
            {OP_SYMBOLS[o]}
          </GameTile>
        ))}
      </div>

      {view.steps.length > 0 ? (
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex flex-col gap-1 text-center text-sm text-white/50">
            {view.steps.map((step, i) => (
              <div key={i} className="animate-pop-in">
                {step.a} {OP_SYMBOLS[step.op]} {step.b} = <span className="font-semibold text-white/80">{step.result}</span>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            isLoading={undoMove.isPending}
            disabled={!!combiningIndices}
            onClick={() => void undoLastStep()}
          >
            ↩ Undo last step
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 text-center text-sm font-medium text-rose-400">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-center text-xs text-white/40">
        Tap a number, tap an operator, then tap a second number to combine them.
      </p>

      <div className="flex justify-center gap-3">
        <Button variant="secondary" onClick={resetSelection} disabled={firstIndex === null && op === null}>
          Clear selection
        </Button>
        <Button onClick={() => void submitFinal()} isLoading={submitMove.isPending}>
          Submit answer
        </Button>
      </div>
    </GameShell>
  );
}
