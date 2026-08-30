import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { Spinner } from "../../../components/Spinner";
import { GameTile } from "../../../components/GameTile";
import { ApiClientError } from "../../../lib/api-client";

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

export function NumberPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("number-puzzle");
  const submitMove = useSubmitMove("number-puzzle");
  const [firstIndex, setFirstIndex] = useState<number | null>(null);
  const [op, setOp] = useState<(typeof OPS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);

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
    if (view.complete) return;
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
    resetSelection();
  };

  const submitFinal = async () => {
    setError(null);
    try {
      const response = await submitMove.mutateAsync({ type: "submit" });
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

  if (view.complete) {
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
        <div className="text-4xl font-bold text-brand-300">{view.target}</div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {view.pool.map((num, i) => (
          <GameTile key={i} state={firstIndex === i ? "selected" : "default"} size="lg" onClick={() => void selectNumber(i)}>
            {num}
          </GameTile>
        ))}
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
        <div className="mb-6 flex flex-col gap-1 text-center text-sm text-white/50">
          {view.steps.map((step, i) => (
            <div key={i}>
              {step.a} {OP_SYMBOLS[step.op]} {step.b} = <span className="font-semibold text-white/80">{step.result}</span>
            </div>
          ))}
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
