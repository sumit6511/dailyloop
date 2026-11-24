import { z } from "zod";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng, pickLeastRecentlyUsed } from "../../rng.js";
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

/** Case-, punctuation-, accent- and leading-"the"-insensitive form used for every comparison. */
export function normalizeGuess(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "Pelé" → "Pele"
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Optimal-string-alignment distance: insertions, deletions, substitutions and adjacent swaps. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** Typos allowed for an answer of this (normalized) length — none for short answers, where a
 * one-letter slip is usually a different word entirely (Mars/Mary, Rome/Rose). */
function allowedTypos(length: number): number {
  if (length < 5) return 0;
  if (length < 9) return 1;
  return 2;
}

function isMatch(guess: string, content: GuessItContent): boolean {
  const normalizedGuess = normalizeGuess(guess);
  if (normalizedGuess.length === 0) return false;
  return [content.answer, ...content.aliases].some((candidate) => {
    const target = normalizeGuess(candidate);
    return (
      target === normalizedGuess ||
      editDistance(target, normalizedGuess) <= allowedTypos(target.length)
    );
  });
}

function replay(content: GuessItContent, moves: GuessItMove[]): ValidationResult<GuessItResult> {
  let cluesRevealed = 1;
  const guesses: GuessItGuess[] = [];
  const tried = new Set<string>();
  let won = false;

  for (const move of moves) {
    // Repeating an earlier wrong guess is almost always a double-submit or a misclick — ignore
    // it rather than spending a clue and a mistake on it.
    const key = normalizeGuess(move.guess);
    if (tried.has(key)) continue;
    tried.add(key);

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

  generatePuzzle(_seed, dateKey, recentlyUsed = []) {
    const rng = createRng(`guess-it-${dateKey}`);
    const entry = pickLeastRecentlyUsed(
      rng,
      GUESS_IT_ENTRIES,
      (e) => e.answer,
      recentlyUsed,
      1,
    )[0]!;
    return {
      category: entry.category,
      answer: entry.answer,
      aliases: entry.aliases,
      clues: entry.clues,
    };
  },

  contentIdentity(content) {
    return [content.answer];
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) return buildScoreBreakdown({ base: 0 });
    const base = CLUES_BASE_SCORE[result.guesses.length] ?? 30;
    return buildScoreBreakdown({
      base,
      speedBonus: speedBonus(meta.durationMs, 10_000, 120_000, 10),
    });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return {
        category: content.category,
        clues: content.clues.slice(0, 1),
        cluesRevealed: 1,
        guesses: [],
        complete: false,
      };
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
