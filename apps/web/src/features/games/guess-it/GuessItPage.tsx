import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { Skeleton } from "../../../components/Skeleton";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";

interface GuessItGuess {
  guess: string;
  correct: boolean;
}

interface GuessItView {
  category: string;
  clues: string[];
  cluesRevealed: number;
  guesses: GuessItGuess[];
  complete: boolean;
  won?: boolean;
  answer?: string;
}

function BoardSkeleton() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <Skeleton className="w-1/3" />
      <div className="flex flex-col gap-2">
        <Skeleton className="w-full" />
        <Skeleton className="w-5/6" />
      </div>
      <Skeleton shape="block" className="h-11 w-full" />
    </div>
  );
}

const CELEBRATE_MS = 600;
const SHAKE_MS = 400;
const MAX_CLUES = 4;

export function GuessItPage() {
  const { data: entry, isLoading } = useGameToday("guess-it");
  const submitMove = useSubmitMove("guess-it");
  const [guess, setGuess] = useState("");
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useAutoStartAttempt("guess-it", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell icon={<GameIcon slug="guess-it" size="lg" />} title="Guess It">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="guess-it" size="lg" />} title="Guess It">
        <p className="text-center text-white/50">No Guess It puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  const view = entry.content as GuessItView | null;
  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="guess-it" size="lg" />} title="Guess It">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  const submitGuess = async () => {
    if (!guess.trim() || view.complete || submitMove.isPending || shake) return;
    setError(null);
    try {
      const response = await submitMove.mutateAsync({ guess: guess.trim() });
      setGuess("");
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
      const newView = response.content as GuessItView;
      if (newView.won) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      } else if (!newView.complete) {
        setShake(true);
        setTimeout(() => setShake(false), SHAKE_MS);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

  const showResult = view.complete && !celebrating;

  if (showResult) {
    return (
      <GameShell icon={<GameIcon slug="guess-it" size="lg" />} title="Guess It">
        <ResultScreen
          gameName="Guess It"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Clues used", value: String(view.cluesRevealed) }]}
          newAchievementKeys={newAchievements}
        >
          {view.answer ? (
            <p className="mb-6 text-sm text-white/60">
              The answer was <span className="font-bold text-white">{view.answer}</span>
            </p>
          ) : null}
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell
      icon={<GameIcon slug="guess-it" size="lg" />}
      title="Guess It"
      subtitle={view.category}
      headerRight={
        <span className="flex items-center gap-1 text-sm font-medium text-white/50">
          Clue {view.cluesRevealed} of {MAX_CLUES}
          {Array.from({ length: MAX_CLUES }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < view.cluesRevealed ? "bg-brand-400" : "bg-white/[0.12]"}`}
            />
          ))}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {view.clues.map((clue, i) => {
          const isCelebratingClue = celebrating && i === view.clues.length - 1;
          return (
            <div
              key={i}
              style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-pop-in relative px-4 py-3 transition-colors ${
                isCelebratingClue ? "border border-emerald-400/40 bg-emerald-500/15" : "glass-subtle"
              }`}
            >
              {isCelebratingClue ? (
                <div className="animate-glow-pulse absolute inset-0 -z-10 rounded-2xl bg-emerald-500/30 blur-lg" aria-hidden="true" />
              ) : null}
              <div className="text-xs font-bold uppercase tracking-wide text-brand-300">Clue {i + 1}</div>
              <p className="mt-1 text-sm text-white/80">{clue}</p>
            </div>
          );
        })}
      </div>

      {view.guesses.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {view.guesses.map((g, i) => (
            <span
              key={i}
              className={`animate-pop-in rounded-full border px-3 py-1 text-xs font-medium ${
                g.correct
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-400/30 bg-rose-500/10 text-rose-300 line-through"
              }`}
            >
              {g.guess}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="animate-pop-in mt-3 text-center text-sm font-medium text-rose-400">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitGuess();
        }}
        className={`mt-6 flex items-end gap-2 ${shake ? "animate-shake" : ""}`}
      >
        <div className="flex-1">
          <TextField
            label="Your guess"
            icon="lightbulb"
            placeholder="Type your answer..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={shake || celebrating}
          />
        </div>
        <Button type="submit" isLoading={submitMove.isPending} disabled={!guess.trim() || shake || celebrating}>
          <Icon name="send" className="text-lg" /> Guess
        </Button>
      </form>
    </GameShell>
  );
}
