import { useCallback, useEffect, useRef, useState } from "react";
import { useGameToday, useAutoStartAttempt, useSubmitMove } from "../../../lib/games-api";
import { GameShell } from "../GameShell";
import { ResultScreen } from "../ResultScreen";
import { Spinner } from "../../../components/Spinner";
import { GameTile, type GameTileState } from "../../../components/GameTile";
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
  correct: "border-emerald-500 bg-emerald-500 text-white",
  present: "border-amber-400 bg-amber-400 text-white",
  absent: "border-white/[0.14] bg-white/[0.08] text-white/60",
};

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

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
      setTimeout(() => setRevealedCols((c) => Math.max(c, col + 1)), col * STAGGER_MS + FLIP_MS / 2),
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
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  if (!entry.available) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <p className="text-center text-white/50">No Word Guess puzzle is available today. Check back soon!</p>
      </GameShell>
    );
  }

  if (!view) {
    return (
      <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess">
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-400" />
        </div>
      </GameShell>
    );
  }

  const letterStatus = new Map<string, LetterStatus>();
  for (const guess of view.guesses.slice(0, settledCount)) {
    for (const fb of guess.feedback) {
      const existing = letterStatus.get(fb.letter);
      if (!existing || STATUS_RANK[fb.status] > STATUS_RANK[existing]) letterStatus.set(fb.letter, fb.status);
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
            <p className="mb-6 text-sm text-white/60">
              The word was <span className="font-bold tracking-wide text-white">{view.answer}</span>
            </p>
          ) : null}
        </ResultScreen>
      </GameShell>
    );
  }

  return (
    <GameShell icon={<GameIcon slug="word-guess" size="lg" />} title="Word Guess" subtitle={`Guess the word in ${MAX_GUESSES} tries.`}>
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
                  className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold uppercase sm:h-14 sm:w-14 ${
                    isAnimating ? "animate-flip" : isCelebrating ? "animate-tile-bounce" : ""
                  } ${
                    feedback && isRevealed
                      ? GRID_FEEDBACK_CLASSES[feedback.status]
                      : letter
                        ? "border-white/40 text-white"
                        : "border-white/[0.14]"
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

      <div className="mt-6 flex flex-col items-center gap-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex gap-1">
            {i === 2 ? (
              <button
                type="button"
                onClick={() => void submitGuess()}
                disabled={submitMove.isPending || current.length !== WORD_LENGTH}
                className="rounded-lg bg-white/[0.08] px-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/[0.14] disabled:opacity-40"
              >
                Enter
              </button>
            ) : null}
            {row.split("").map((letter) => (
              <GameTile
                key={letter}
                state={letterStatus.has(letter) ? STATUS_TO_TILE_STATE[letterStatus.get(letter)!] : "default"}
                onClick={() => setCurrent((prev) => (prev.length < WORD_LENGTH ? prev + letter : prev))}
                className="!h-11 !w-6 rounded-lg border-0 px-0 text-sm normal-case sm:!w-9"
              >
                {letter}
              </GameTile>
            ))}
            {i === 2 ? (
              <button
                type="button"
                onClick={() => setCurrent((prev) => prev.slice(0, -1))}
                aria-label="Backspace"
                className="rounded-lg bg-white/[0.08] px-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/[0.14]"
              >
                <Icon name="backspace" className="text-base" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </GameShell>
  );
}
