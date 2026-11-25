import { useCallback, useEffect, useRef, useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Skeleton } from "../../../components/Skeleton";
import { GameTile, type GameTileState } from "../../../components/GameTile";
import { DotMeter, HudChip } from "../Hud";
import { GameIcon } from "../../../components/GameIcon";
import { Icon } from "../../../components/Icon";
import { ApiClientError } from "../../../lib/api-client";

type LetterStatus = "correct" | "present" | "absent";

interface LetterFeedback {
  letter: string;
  status: LetterStatus;
}

interface WordGuessGuess {
  word: string;
  feedback: LetterFeedback[];
}

interface WordGuessView {
  guesses: WordGuessGuess[];
  guessesRemaining: number;
  complete: boolean;
  won?: boolean;
  answer?: string;
}

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const STATUS_RANK: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

const STATUS_TO_TILE_STATE: Record<LetterStatus, GameTileState> = {
  correct: "correct",
  present: "present",
  absent: "absent",
};

const GRID_FEEDBACK_CLASSES: Record<LetterStatus, string> = {
  correct:
    "border-emerald-300/60 bg-emerald-500 text-on-accent shadow-[0_8px_24px_-10px_rgb(16_185_129/0.9)]",
  present: "border-amber-200/60 bg-amber-400 text-amber-950",
  absent: "border-white/[0.04] bg-white/[0.06] text-fg-subtle",
};

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const WIDE_KEY_CLASSES =
  "flex h-12 min-w-0 max-w-[4.5rem] flex-[1.6] items-center justify-center rounded-lg px-1 text-xs font-bold uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-400/60 disabled:cursor-not-allowed sm:h-14";

function BoardSkeleton() {
  return (
    <div className="mx-auto flex flex-col gap-1.5">
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} className="flex gap-1.5">
          {Array.from({ length: WORD_LENGTH }, (_, col) => (
            <Skeleton key={col} shape="block" className="h-12 w-12 sm:h-14 sm:w-14" />
          ))}
        </div>
      ))}
    </div>
  );
}

const FLIP_MS = 500;
const STAGGER_MS = 220;

export function WordGuessPage() {
  const { data: entry, isLoading } = useGameToday("word-guess");
  const submitMove = useSubmitMove("word-guess");
  const [current, setCurrent] = useState("");
  const [shakeRow, setShakeRow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [revealedCols, setRevealedCols] = useState(0);
  const [settledCount, setSettledCount] = useState(0);
  const [celebrateRow, setCelebrateRow] = useState<number | null>(null);
  const prevGuessCountRef = useRef<number | null>(null);

  useAutoStartAttempt("word-guess", entry?.status);

  const view = (entry?.content ?? null) as WordGuessView | null;
  const complete = view?.complete ?? false;

  useEffect(() => {
    const count = view?.guesses.length;
    if (count === undefined) return;
    if (prevGuessCountRef.current === null) {
      prevGuessCountRef.current = count;
      setSettledCount(count);
      return;
    }
    if (count <= prevGuessCountRef.current) {
      prevGuessCountRef.current = count;
      return;
    }
    const newRowIndex = count - 1;
    const wonThisRow = view!.guesses[newRowIndex]!.feedback.every((f) => f.status === "correct");
    prevGuessCountRef.current = count;
    setAnimatingRow(newRowIndex);
    setRevealedCols(0);
    const timers = Array.from({ length: WORD_LENGTH }, (_, col) =>
      setTimeout(
        () => setRevealedCols((c) => Math.max(c, col + 1)),
        col * STAGGER_MS + FLIP_MS / 2,
      ),
    );
    const finishTimer = setTimeout(
      () => {
        setAnimatingRow(null);
        setSettledCount(count);
        if (wonThisRow) {
          setCelebrateRow(newRowIndex);
          setTimeout(() => setCelebrateRow(null), 700);
        }
      },
      (WORD_LENGTH - 1) * STAGGER_MS + FLIP_MS,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.guesses.length]);

  const submitGuess = useCallback(async () => {
    if (!view || current.length !== WORD_LENGTH || complete || submitMove.isPending) return;
    setError(null);
    try {
      const response = await submitMove.mutateAsync({ guess: current });
      setCurrent("");
      if (response.newlyUnlockedAchievements?.length) {
        setNewAchievements(response.newlyUnlockedAchievements);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 400);
    }
  }, [current, complete, submitMove, view]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!view || complete || submitMove.isPending) return;
      if (e.key === "Enter") {
        void submitGuess();
      } else if (e.key === "Backspace") {
        setCurrent((prev) => prev.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key) && current.length < WORD_LENGTH) {
        setCurrent((prev) => (prev + e.key).toUpperCase());
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, complete, submitMove.isPending, submitGuess, view]);

  if (isLoading || !entry) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <p className="text-center text-fg-subtle">
          No Word Guess puzzle is available today. Check back soon!
        </p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <div className="py-4">
          <BoardSkeleton />
        </div>
      </GameShell>
    );
  }

  const letterStatus = new Map<string, LetterStatus>();
  for (const guess of view.guesses.slice(0, settledCount)) {
    for (const fb of guess.feedback) {
      const existing = letterStatus.get(fb.letter);
      if (!existing || STATUS_RANK[fb.status] > STATUS_RANK[existing])
        letterStatus.set(fb.letter, fb.status);
    }
  }

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    if (i < view.guesses.length) return view.guesses[i]!;
    if (i === view.guesses.length && !complete) return { word: current, feedback: null };
    return null;
  });

  // Don't cut straight to the result screen while the final row is still flipping or bouncing.
  const showResult = complete && animatingRow === null && celebrateRow === null;

  if (showResult) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <ResultScreen
          gameName="Word Guess"
          won={!!view.won}
          score={entry.score ?? 0}
          stats={[{ label: "Guesses", value: `${view.guesses.length}/${MAX_GUESSES}` }]}
          newAchievementKeys={newAchievements}
        >
          {view.answer ? (
            <p className="mb-6 text-sm text-fg-muted">
              The word was <span className="font-bold tracking-wide text-white">{view.answer}</span>
            </p>
          ) : null}
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell
      icon={<GameIcon slug="word-guess" size="lg" />}
      title="Word Guess"
      subtitle={`Guess the word in ${MAX_GUESSES} tries.`}
      headerRight={
        <HudChip label="Tries left">
          <span className="sr-only">{MAX_GUESSES - view.guesses.length}</span>
          <DotMeter total={MAX_GUESSES} filled={MAX_GUESSES - view.guesses.length} tone="brand" />
        </HudChip>
      }
    >
      <div className="mx-auto flex flex-col gap-1.5">
        {rows.map((row, rowIndex) => {
          const isCurrentRow = rowIndex === view.guesses.length && !complete;
          const rowLabel = row?.feedback
            ? `Guess ${rowIndex + 1}: ${row.feedback.map((f) => `${f.letter} ${f.status}`).join(", ")}`
            : isCurrentRow
              ? `Current guess: ${current || "empty"}`
              : `Row ${rowIndex + 1}: empty`;
          return (
            <div
              key={rowIndex}
              role="group"
              aria-label={rowLabel}
              className={`flex justify-center gap-1.5 ${shakeRow && rowIndex === view.guesses.length ? "animate-shake" : ""}`}
            >
              {Array.from({ length: WORD_LENGTH }, (_, colIndex) => {
                const letter = row?.word[colIndex] ?? "";
                const feedback = row?.feedback?.[colIndex];
                const isAnimating = rowIndex === animatingRow;
                const isRevealed = !isAnimating || colIndex < revealedCols;
                const isCelebrating = rowIndex === celebrateRow;
                return (
                  <div
                    key={colIndex}
                    style={
                      isAnimating
                        ? { animationDelay: `${colIndex * STAGGER_MS}ms` }
                        : isCelebrating
                          ? { animationDelay: `${colIndex * 70}ms` }
                          : undefined
                    }
                    className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-xl border font-display text-2xl font-bold uppercase sm:h-[3.75rem] sm:w-[3.75rem] ${
                      isAnimating ? "animate-flip" : isCelebrating ? "animate-tile-bounce" : ""
                    } ${
                      feedback && isRevealed
                        ? GRID_FEEDBACK_CLASSES[feedback.status]
                        : letter
                          ? "border-white/45 bg-white/[0.06] text-white"
                          : isCurrentRow
                            ? "border-white/[0.16] bg-ink-850/60"
                            : "border-white/[0.08] bg-ink-850/40"
                    }`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-center text-sm font-medium text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-lg flex-col gap-1.5 sm:gap-2">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex w-full justify-center gap-1 sm:gap-1.5">
            {i === 2 ? (
              <button
                type="button"
                onClick={() => void submitGuess()}
                disabled={submitMove.isPending || current.length !== WORD_LENGTH}
                className={`${WIDE_KEY_CLASSES} bg-gradient-to-b from-brand-500 to-brand-600 text-on-accent disabled:from-white/[0.08] disabled:to-white/[0.08] disabled:text-white/40`}
              >
                Enter
              </button>
            ) : null}
            {row.split("").map((letter) => (
              <GameTile
                key={letter}
                state={
                  letterStatus.has(letter)
                    ? STATUS_TO_TILE_STATE[letterStatus.get(letter)!]
                    : "default"
                }
                onClick={() =>
                  setCurrent((prev) => (prev.length < WORD_LENGTH ? prev + letter : prev))
                }
                className="!h-12 min-w-0 !w-auto max-w-[2.75rem] flex-1 rounded-lg px-0 text-sm sm:!h-14 sm:max-w-[3rem] sm:text-base"
              >
                {letter}
              </GameTile>
            ))}
            {i === 2 ? (
              <button
                type="button"
                onClick={() => setCurrent((prev) => prev.slice(0, -1))}
                aria-label="Backspace"
                className={`${WIDE_KEY_CLASSES} border border-white/[0.1] bg-ink-800/80 text-white/80 hover:bg-ink-700`}
              >
                <Icon name="backspace" className="text-xl" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </GameShell>
  );
}
