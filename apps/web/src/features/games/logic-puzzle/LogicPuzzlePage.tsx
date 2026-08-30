import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Spinner } from "../../../components/Spinner";
import { GameTile } from "../../../components/GameTile";
import { ApiClientError } from "../../../lib/api-client";

interface LogicPuzzleView {
  puzzle: number[][];
  grid: number[][];
  complete: boolean;
  won?: boolean;
}

export function LogicPuzzlePage() {
  const { data: entry, isLoading } = useGameToday("logic-puzzle");
  const submitMove = useSubmitMove("logic-puzzle");
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useAutoStartAttempt("logic-puzzle", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell icon="🧠" title="Logic Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon="🧠" title="Logic Puzzle">
        <p className="text-center text-white/50">No Logic Puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  const view = entry.content as LogicPuzzleView | null;
  if (!view) {
    return (
      <GameShell icon="🧠" title="Logic Puzzle">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  const isGiven = (row: number, col: number) => view.puzzle[row]![col] !== 0;

  const fillCell = async (value: number) => {
    if (!selected || view.complete || isGiven(selected.row, selected.col)) return;
    setError(null);
    try {
      const response = await submitMove.mutateAsync({ row: selected.row, col: selected.col, value });
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

  if (view.complete) {
    return (
      <GameShell icon="🧠" title="Logic Puzzle">
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
    <GameShell icon="🧠" title="Logic Puzzle" subtitle="Fill every row, column, and box with 1–6.">
      <div className="mx-auto grid w-fit grid-cols-6 gap-0.5 rounded-xl border-2 border-white/[0.16] bg-white/[0.16] p-0.5">
        {view.grid.map((row, r) =>
          row.map((value, c) => {
            const given = isGiven(r, c);
            const isSelected = selected?.row === r && selected?.col === c;
            const rightBorder = c === 2 ? "border-r-2 border-r-white/[0.16]" : "";
            const bottomBorder = r === 1 || r === 3 ? "border-b-2 border-b-white/[0.16]" : "";
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={given}
                onClick={() => setSelected({ row: r, col: c })}
                className={`flex h-11 w-11 items-center justify-center text-lg font-bold transition-colors sm:h-12 sm:w-12 ${rightBorder} ${bottomBorder} ${
                  given
                    ? "bg-white/[0.03] text-white/50"
                    : isSelected
                      ? "bg-brand-600 text-white"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
                }`}
              >
                {value !== 0 ? value : ""}
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

      <div className="mt-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <GameTile key={n} size="sm" onClick={() => void fillCell(n)} disabled={!selected}>
            {n}
          </GameTile>
        ))}
        <GameTile size="sm" onClick={() => void fillCell(0)} disabled={!selected}>
          ⌫
        </GameTile>
      </div>
    </GameShell>
  );
}
