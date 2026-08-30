import { z } from "zod";
import { dateKeyToJSDate } from "@dailyloop/shared";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { ANSWER_WORDS, EXTRA_VALID_GUESSES } from "./words.js";

const MAX_GUESSES = 6;
const ALL_VALID_GUESSES = new Set<string>([...ANSWER_WORDS, ...EXTRA_VALID_GUESSES]);

export interface WordGuessContent {
  /** Server-only — never sent to the client until the attempt is complete. */
  answer: string;
}

export interface WordGuessMove {
  guess: string;
}

export type LetterStatus = "correct" | "present" | "absent";

export interface LetterFeedback {
  letter: string;
  status: LetterStatus;
}

export interface WordGuessGuess {
  word: string;
  feedback: LetterFeedback[];
}

export interface WordGuessResult {
  guesses: WordGuessGuess[];
  won: boolean;
  gaveUp: boolean;
}

const GUESSES_BASE_SCORE: Record<number, number> = { 1: 90, 2: 85, 3: 75, 4: 60, 5: 45, 6: 30 };

/** Standard Wordle two-pass algorithm — handles repeated letters correctly. */
function computeFeedback(guess: string, answer: string): LetterFeedback[] {
  const guessLetters = guess.split("");
  const answerLetters = answer.split("");
  const statuses: LetterStatus[] = new Array(5).fill("absent");
  const remaining = new Map<string, number>();

  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      statuses[i] = "correct";
    } else {
      const letter = answerLetters[i]!;
      remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
    }
  }

  for (let i = 0; i < 5; i++) {
    if (statuses[i] === "correct") continue;
    const letter = guessLetters[i]!;
    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      statuses[i] = "present";
      remaining.set(letter, count - 1);
    }
  }

  return guessLetters.map((letter, i) => ({ letter, status: statuses[i]! }));
}

function replay(content: WordGuessContent, moves: WordGuessMove[]): ValidationResult<WordGuessResult> {
  const guesses: WordGuessGuess[] = moves.map((move) => ({
    word: move.guess,
    feedback: computeFeedback(move.guess, content.answer),
  }));
  const won = guesses.some((g) => g.word === content.answer);
  const gaveUp = !won && guesses.length >= MAX_GUESSES;
  const mistakes = won ? guesses.length - 1 : guesses.length;

  return { won, complete: won || gaveUp, mistakes, result: { guesses, won, gaveUp } };
}

function daysSinceEpoch(dateKey: string): number {
  return Math.floor(dateKeyToJSDate(dateKey).getTime() / 86_400_000);
}

export const wordGuessGame: DailyGameModule<WordGuessContent, WordGuessMove, WordGuessResult> = {
  id: "word-guess",
  name: "Word Guess",
  description: "Guess the daily word in six tries.",
  icon: "🟨",
  difficulty: "medium",

  contentSchema: z.object({ answer: z.string().regex(/^[A-Z]{5}$/) }),

  moveSchema: z.object({
    guess: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .pipe(
        z
          .string()
          .regex(/^[A-Z]{5}$/, "Guess must be 5 letters")
          .refine((s) => ALL_VALID_GUESSES.has(s), "Not a word in our dictionary"),
      ),
  }),

  generatePuzzle(_seed, dateKey) {
    const index = daysSinceEpoch(dateKey) % ANSWER_WORDS.length;
    return { answer: ANSWER_WORDS[index]! };
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) return buildScoreBreakdown({ base: 0 });
    const base = GUESSES_BASE_SCORE[result.guesses.length] ?? 30;
    return buildScoreBreakdown({ base, speedBonus: speedBonus(meta.durationMs, 20_000, 300_000, 10) });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return { guesses: [], guessesRemaining: MAX_GUESSES, complete: false };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      guesses: result.guesses,
      guessesRemaining: MAX_GUESSES - result.guesses.length,
      complete,
      won: complete ? result.won : undefined,
      ...(complete ? { answer: content.answer } : {}),
    };
  },
};
