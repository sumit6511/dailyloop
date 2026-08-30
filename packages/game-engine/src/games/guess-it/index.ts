import { z } from "zod";
import { dateKeyToJSDate } from "@dailyloop/shared";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { GUESS_IT_ENTRIES } from "./entries.js";

const CLUE_COUNT = 4;

export interface GuessItContent {
  category: string;
  /** Server-only until the attempt is complete. */
  answer: string;
  aliases: string[];
  clues: [string, string, string, string];
}

export interface GuessItMove {
  guess: string;
}

export interface GuessItGuess {
  guess: string;
  correct: boolean;
}

export interface GuessItResult {
  guesses: GuessItGuess[];
  cluesRevealed: number;
  won: boolean;
  gaveUp: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isMatch(guess: string, content: GuessItContent): boolean {
  const normalizedGuess = normalize(guess);
  if (normalizedGuess.length === 0) return false;
  return normalize(content.answer) === normalizedGuess || content.aliases.some((a) => normalize(a) === normalizedGuess);
}

function replay(content: GuessItContent, moves: GuessItMove[]): ValidationResult<GuessItResult> {
  let cluesRevealed = 1;
  const guesses: GuessItGuess[] = [];
  let won = false;

  for (const move of moves) {
    const correct = isMatch(move.guess, content);
    guesses.push({ guess: move.guess, correct });
    if (correct) {
      won = true;
      break;
    }
    cluesRevealed = Math.min(CLUE_COUNT, cluesRevealed + 1);
  }

  const usedAllClues = guesses.length >= CLUE_COUNT;
  const complete = won || usedAllClues;
  const gaveUp = !won && usedAllClues;
  const mistakes = won ? guesses.length - 1 : guesses.length;

  return { won, complete, mistakes, result: { guesses, cluesRevealed, won, gaveUp } };
}

function daysSinceEpoch(dateKey: string): number {
  return Math.floor(dateKeyToJSDate(dateKey).getTime() / 86_400_000);
}

const CLUES_BASE_SCORE: Record<number, number> = { 1: 90, 2: 70, 3: 50, 4: 30 };

export const guessItGame: DailyGameModule<GuessItContent, GuessItMove, GuessItResult> = {
  id: "guess-it",
  name: "Guess It",
  description: "Identify the mystery answer from four clues.",
  icon: "🎯",
  difficulty: "easy",

  contentSchema: z.object({
    category: z.string(),
    answer: z.string(),
    aliases: z.array(z.string()),
    clues: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  }),

  moveSchema: z.object({ guess: z.string().min(1).max(100) }),

  generatePuzzle(_seed, dateKey) {
    const index = daysSinceEpoch(dateKey) % GUESS_IT_ENTRIES.length;
    const entry = GUESS_IT_ENTRIES[index]!;
    return { category: entry.category, answer: entry.answer, aliases: entry.aliases, clues: entry.clues };
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) return buildScoreBreakdown({ base: 0 });
    const base = CLUES_BASE_SCORE[result.guesses.length] ?? 30;
    return buildScoreBreakdown({ base, speedBonus: speedBonus(meta.durationMs, 10_000, 120_000, 10) });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return { category: content.category, clues: content.clues.slice(0, 1), cluesRevealed: 1, guesses: [], complete: false };
    }
    const { result } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      category: content.category,
      clues: content.clues.slice(0, result.cluesRevealed),
      cluesRevealed: result.cluesRevealed,
      guesses: result.guesses,
      complete,
      won: complete ? result.won : undefined,
      ...(complete ? { answer: content.answer } : {}),
    };
  },
};
