import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { Spinner } from "../../../components/Spinner";
import { GameTile } from "../../../components/GameTile";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";

interface SolvedGroup {
  categoryIndex: number;
  title: string;
  difficulty: 1 | 2 | 3 | 4;
  words: string[];
}

interface ConnectionsView {
  words: string[];
  solved: SolvedGroup[];
  mistakesRemaining: number;
  complete: boolean;
  categories?: SolvedGroup[];
}

const DIFFICULTY_STYLES: Record<number, string> = {
  1: "border border-yellow-400/30 bg-yellow-500/20 text-yellow-200",
  2: "border border-green-400/30 bg-green-500/20 text-green-200",
  3: "border border-blue-400/30 bg-blue-500/20 text-blue-200",
  4: "border border-purple-400/30 bg-purple-500/20 text-purple-200",
};

// Color alone shouldn't be the only way to tell difficulty tiers apart — a text label carries
// the same information for colorblind players (the category title/words are always shown too,
// so this is purely about the difficulty *tier*, not identifying the category itself).
const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easiest",
  2: "Easy",
  3: "Tricky",
  4: "Hardest",
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const MAX_MISTAKES = 4;

const REVEAL_MS = 650;
const SHAKE_MS = 450;

export function ConnectionsPage() {
  const { data: entry, isLoading } = useGameToday("connections");
  const submitMove = useSubmitMove("connections");
  const [selected, setSelected] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [pendingSolve, setPendingSolve] = useState<{ words: string[]; categoryIndex: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null);
  const busy = !!pendingSolve || shake;

  useAutoStartAttempt("connections", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell icon={<GameIcon slug="connections" size="lg" />} title="Connections">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="connections" size="lg" />} title="Connections">
        <p className="text-center text-white/50">No Connections puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  const view = entry.content as ConnectionsView | null;
  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="connections" size="lg" />} title="Connections">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  // While a correct group is mid-reveal, hold it back from `solved` so its tiles stay in the
  // grid (flashing green) instead of instantly jumping into the category bar.
  const solvedToShow = pendingSolve ? view.solved.filter((g) => g.categoryIndex !== pendingSolve.categoryIndex) : view.solved;
  const solvedWords = new Set(solvedToShow.flatMap((group) => group.words));
  const remainingWords = view.words.filter((word) => !solvedWords.has(word));
  // A manual shuffle only ever reorders — it never changes which words are still in play, so
  // re-filter the last shuffled snapshot against the authoritative remaining set every render.
  const displayWords = shuffledOrder ? shuffledOrder.filter((word) => remainingWords.includes(word)) : remainingWords;
  // Likewise, don't jump to the result screen mid-reveal even if the server says we're done.
  const showResult = view.complete && !pendingSolve;

  const toggleWord = (word: string) => {
    if (view.complete || busy) return;
    setSelected((prev) => {
      if (prev.includes(word)) return prev.filter((w) => w !== word);
      if (prev.length >= 4) return prev;
      return [...prev, word];
    });
  };

  const submitGuess = async () => {
    if (selected.length !== 4 || busy) return;
    setError(null);
    try {
      const solvedBefore = view.solved.length;
      const guessedWords = selected;
      const response = await submitMove.mutateAsync({ words: guessedWords });
      const newSolved = (response.content as ConnectionsView).solved;
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
      if (newSolved.length > solvedBefore) {
        const newGroup = newSolved[newSolved.length - 1]!;
        setSelected([]);
        setPendingSolve({ words: guessedWords, categoryIndex: newGroup.categoryIndex });
        setTimeout(() => setPendingSolve(null), REVEAL_MS);
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setSelected([]);
        }, SHAKE_MS);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  };

  if (showResult) {
    const mistakesMade = MAX_MISTAKES - view.mistakesRemaining;
    return (
      <GameShell icon={<GameIcon slug="connections" size="lg" />} title="Connections">
        <ResultScreen
          gameName="Connections"
          won={view.solved.length === 4}
          score={entry.score ?? 0}
          stats={[{ label: "Mistakes", value: String(mistakesMade) }]}
          newAchievementKeys={newAchievements}
        >
          <div className="mb-6 flex flex-col gap-2">
            {(view.categories ?? view.solved).map((category, i) => (
              <div
                key={category.title}
                style={{ animationDelay: `${i * 90}ms` }}
                className={`animate-pop-in rounded-xl px-4 py-2.5 text-center ${DIFFICULTY_STYLES[category.difficulty]}`}
              >
                <div className="text-xs font-bold uppercase tracking-wide">
                  {category.title} <span className="opacity-70">· {DIFFICULTY_LABELS[category.difficulty]}</span>
                </div>
                <div className="text-sm font-medium">{category.words.join(", ")}</div>
              </div>
            ))}
          </div>
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell
      icon={<GameIcon slug="connections" size="lg" />}
      title="Connections"
      subtitle="Find groups of four!"
      headerRight={
        <span className="flex items-center gap-1 text-sm font-medium text-white/50">
          Mistakes:
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < view.mistakesRemaining ? "bg-white/50" : "bg-white/[0.12]"}`} />
          ))}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {solvedToShow.map((group, i) => (
          <div
            key={group.categoryIndex}
            style={{ animationDelay: `${i * 90}ms` }}
            className={`animate-pop-in rounded-xl px-4 py-2.5 text-center ${DIFFICULTY_STYLES[group.difficulty]}`}
          >
            <div className="text-xs font-bold uppercase tracking-wide">
              {group.title} <span className="opacity-70">· {DIFFICULTY_LABELS[group.difficulty]}</span>
            </div>
            <div className="text-sm font-medium">{group.words.join(", ")}</div>
          </div>
        ))}

        <div className={`grid grid-cols-4 gap-2 ${shake ? "animate-shake" : ""}`}>
          {displayWords.map((word) => {
            const isPending = pendingSolve?.words.includes(word);
            const isWrong = shake && selected.includes(word);
            const state = isPending ? "correct" : isWrong ? "wrong" : selected.includes(word) ? "selected" : "default";
            return (
              <GameTile
                key={word}
                state={state}
                size="sm"
                onClick={() => toggleWord(word)}
                className="aspect-square h-auto w-full p-1 text-center text-[11px] leading-tight sm:text-sm"
              >
                {word}
              </GameTile>
            );
          })}
        </div>
      </div>

      {error ? (
        <p role="alert" className="animate-pop-in mt-3 text-center text-sm font-medium text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={() => setShuffledOrder(shuffle(displayWords))} disabled={busy}>
          <Icon name="shuffle" className="text-lg" /> Shuffle
        </Button>
        <Button variant="secondary" onClick={() => setSelected([])} disabled={selected.length === 0 || busy}>
          <Icon name="close" className="text-lg" /> Deselect all
        </Button>
        <Button onClick={() => void submitGuess()} isLoading={submitMove.isPending} disabled={selected.length !== 4 || busy}>
          <Icon name="check" className="text-lg" /> Submit
        </Button>
      </div>
    </GameShell>
  );
}
