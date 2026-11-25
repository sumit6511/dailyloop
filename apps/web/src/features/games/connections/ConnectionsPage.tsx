import { useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Button } from "../../../components/Button";
import { Skeleton } from "../../../components/Skeleton";
import { GameTile } from "../../../components/GameTile";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";
import { DIFFICULTY_LABELS, DIFFICULTY_STYLES } from "./difficulty";
import { DotMeter, HudChip } from "../Hud";

interface SolvedGroup {
  categoryIndex: number;
  title: string;
  difficulty: 1 | 2 | 3 | 4;
  words: string[];
}

interface ConnectionsGuess {
  words: string[];
  correct: boolean;
  oneAway: boolean;
}

interface ConnectionsView {
  words: string[];
  solved: SolvedGroup[];
  /** Absent from responses before this existed. */
  guesses?: ConnectionsGuess[];
  lastMoveRepeated?: boolean;
  mistakesRemaining: number;
  complete: boolean;
  categories?: SolvedGroup[];
}

function BoardSkeleton() {
  return (
    <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
      {Array.from({ length: 16 }, (_, i) => (
        <Skeleton key={i} shape="block" className="aspect-square" />
      ))}
    </div>
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const MAX_MISTAKES = 4;
const NOTICE_MS = 1800;

/** Same identity the server uses: the four words, ignoring order and case. */
function guessKey(words: string[]): string {
  return words
    .map((w) => w.trim().toUpperCase())
    .sort()
    .join("|");
}

const REVEAL_MS = 650;
const SHAKE_MS = 450;

export function ConnectionsPage() {
  const { data: entry, isLoading } = useGameToday("connections");
  const submitMove = useSubmitMove("connections");
  const [selected, setSelected] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [pendingSolve, setPendingSolve] = useState<{
    words: string[];
    categoryIndex: number;
  } | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Transient, non-error feedback: "One away…" / "Already guessed!".
  const [notice, setNotice] = useState<string | null>(null);
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null);
  const busy = !!pendingSolve || shake;

  useAutoStartAttempt("connections", entry?.status);

  if (isLoading || !entry) {
    return (
      <GameShell
        slug="connections"
        icon={<GameIcon slug="connections" size="lg" />}
        title="Connections"
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
        slug="connections"
        icon={<GameIcon slug="connections" size="lg" />}
        title="Connections"
      >
        <p className="text-center text-fg-subtle">
          No Connections puzzle is available today. Check back soon!
        </p>
      </GameShell>
    );
  }

  const view = entry.content as ConnectionsView | null;
  if (!view) {
    return (
      <GameShell
        slug="connections"
        icon={<GameIcon slug="connections" size="lg" />}
        title="Connections"
      >
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  // While a correct group is mid-reveal, hold it back from `solved` so its tiles stay in the
  // grid (flashing green) instead of instantly jumping into the category bar.
  const solvedToShow = pendingSolve
    ? view.solved.filter((g) => g.categoryIndex !== pendingSolve.categoryIndex)
    : view.solved;
  const solvedWords = new Set(solvedToShow.flatMap((group) => group.words));
  const remainingWords = view.words.filter((word) => !solvedWords.has(word));
  // A manual shuffle only ever reorders — it never changes which words are still in play, so
  // re-filter the last shuffled snapshot against the authoritative remaining set every render.
  const displayWords = shuffledOrder
    ? shuffledOrder.filter((word) => remainingWords.includes(word))
    : remainingWords;
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

  const flashNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice((prev) => (prev === message ? null : prev)), NOTICE_MS);
  };

  const submitGuess = async () => {
    if (selected.length !== 4 || busy) return;
    setError(null);
    // Repeats never cost a life (the server ignores them too) — just say so without sending.
    if ((view.guesses ?? []).some((g) => guessKey(g.words) === guessKey(selected))) {
      flashNotice("Already guessed!");
      return;
    }
    try {
      const solvedBefore = view.solved.length;
      const guessedWords = selected;
      const response = await submitMove.mutateAsync({ words: guessedWords });
      const newView = response.content as ConnectionsView;
      const newSolved = newView.solved;
      if (newView.lastMoveRepeated) {
        flashNotice("Already guessed!");
        return;
      }
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
      if (newSolved.length > solvedBefore) {
        const newGroup = newSolved[newSolved.length - 1]!;
        setSelected([]);
        setPendingSolve({ words: guessedWords, categoryIndex: newGroup.categoryIndex });
        setTimeout(() => setPendingSolve(null), REVEAL_MS);
      } else {
        if (!newView.complete && newView.guesses?.at(-1)?.oneAway) flashNotice("One away…");
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
      <GameShell
        slug="connections"
        icon={<GameIcon slug="connections" size="lg" />}
        title="Connections"
      >
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
                  {category.title}{" "}
                  <span className="opacity-70">· {DIFFICULTY_LABELS[category.difficulty]}</span>
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
      slug="connections"
      showRulesOnFirstVisit
      icon={<GameIcon slug="connections" size="lg" />}
      title="Connections"
      subtitle="Find groups of four!"
      headerRight={
        <HudChip label="Mistakes left">
          <span className="sr-only">{view.mistakesRemaining}</span>
          <DotMeter total={MAX_MISTAKES} filled={view.mistakesRemaining} tone="brand" />
        </HudChip>
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
              {group.title}{" "}
              <span className="opacity-70">· {DIFFICULTY_LABELS[group.difficulty]}</span>
            </div>
            <div className="text-sm font-medium">{group.words.join(", ")}</div>
          </div>
        ))}

        <div className={`grid grid-cols-4 gap-2 sm:gap-2.5 ${shake ? "animate-shake" : ""}`}>
          {displayWords.map((word) => {
            const isPending = pendingSolve?.words.includes(word);
            const isWrong = shake && selected.includes(word);
            const state = isPending
              ? "correct"
              : isWrong
                ? "wrong"
                : selected.includes(word)
                  ? "selected"
                  : "default";
            return (
              <GameTile
                key={word}
                state={state}
                size="sm"
                onClick={() => toggleWord(word)}
                className="aspect-[5/4] h-auto w-full break-words p-1 text-center text-[11px] leading-tight tracking-wide sm:aspect-[2/1] sm:text-[15px]"
              >
                {word}
              </GameTile>
            );
          })}
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="animate-pop-in mt-3 text-center text-sm font-semibold text-amber-200"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="animate-pop-in mt-3 text-center text-sm font-medium text-rose-400"
        >
          {error}
        </p>
      ) : null}

      <div className="mx-auto grid w-full max-w-md grid-cols-[auto_auto_1fr] gap-2 sm:gap-3">
        <Button
          variant="secondary"
          onClick={() => setShuffledOrder(shuffle(displayWords))}
          disabled={busy}
          aria-label="Shuffle"
        >
          <Icon name="shuffle" className="text-lg" />
          <span className="hidden sm:inline">Shuffle</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSelected([])}
          disabled={selected.length === 0 || busy}
          aria-label="Deselect all"
        >
          <Icon name="close" className="text-lg" />
          <span className="hidden sm:inline">Deselect</span>
        </Button>
        <Button
          onClick={() => void submitGuess()}
          isLoading={submitMove.isPending}
          disabled={selected.length !== 4 || busy}
        >
          <Icon name="check" className="text-lg" /> Submit
          <span className="tabular font-mono text-xs text-fg-muted" aria-hidden="true">
            {selected.length}/4
          </span>
        </Button>
      </div>
    </GameShell>
  );
}
