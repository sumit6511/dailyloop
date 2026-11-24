import { z } from "zod";
import { MAX_MISTAKES } from "@dailyloop/shared";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { shuffle, createRng, pickLeastRecentlyUsed } from "../../rng.js";
import {
  CATEGORY_BANK,
  type ConnectionsBankEntry,
  type ConnectionsCategory,
} from "./categories.js";

export interface ConnectionsContent {
  /** Answer key — server-only, never sent to the client until a category is solved. */
  categories: ConnectionsCategory[];
  /** The same 16 words as `categories[].words`, flattened and shuffled — safe to send anytime. */
  words: string[];
}

export interface ConnectionsMove {
  words: string[];
}

export interface SolvedGroup {
  categoryIndex: number;
  title: string;
  difficulty: 1 | 2 | 3 | 4;
  words: string[];
}

/** One counted guess (repeats are dropped before they get here). */
export interface ConnectionsGuess {
  words: string[];
  correct: boolean;
  /** Wrong, but three of the four words do belong to one unsolved category. */
  oneAway: boolean;
}

export interface ConnectionsResult {
  solved: SolvedGroup[];
  guesses: ConnectionsGuess[];
  mistakes: number;
  won: boolean;
  gaveUp: boolean;
  /** The most recent move repeated an earlier guess, so it was ignored (no mistake charged). */
  lastMoveRepeated: boolean;
}

const MAX_MISTAKES_ALLOWED = MAX_MISTAKES.connections;

function normalizeWord(word: string): string {
  return word.trim().toUpperCase();
}

function sameWordSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(normalizeWord));
  const setB = new Set(b.map(normalizeWord));
  if (setA.size !== setB.size) return false;
  for (const word of setA) if (!setB.has(word)) return false;
  return true;
}

/** Order- and case-insensitive identity of a guess, so the same four words always match. */
function guessKey(words: readonly string[]): string {
  return words.map(normalizeWord).sort().join("|");
}

function replay(
  content: ConnectionsContent,
  moves: ConnectionsMove[],
): ValidationResult<ConnectionsResult> {
  const solved: SolvedGroup[] = [];
  const solvedIndices = new Set<number>();
  const guesses: ConnectionsGuess[] = [];
  const tried = new Set<string>();
  let mistakes = 0;
  let lastMoveRepeated = false;

  for (const move of moves) {
    // Re-submitting an earlier guess (a double-tap, or forgetting it was tried) tells the player
    // nothing new, so it's ignored rather than costing a life — and never re-solves a group.
    const key = guessKey(move.words);
    lastMoveRepeated = tried.has(key);
    if (lastMoveRepeated) continue;
    tried.add(key);

    const matchIndex = content.categories.findIndex(
      (category, index) => !solvedIndices.has(index) && sameWordSet(category.words, move.words),
    );
    if (matchIndex >= 0) {
      solvedIndices.add(matchIndex);
      const category = content.categories[matchIndex]!;
      solved.push({
        categoryIndex: matchIndex,
        title: category.title,
        difficulty: category.difficulty,
        words: [...category.words],
      });
      guesses.push({ words: [...move.words], correct: true, oneAway: false });
    } else {
      mistakes++;
      const guessed = new Set(move.words.map(normalizeWord));
      const oneAway = content.categories.some(
        (category, index) =>
          !solvedIndices.has(index) &&
          category.words.filter((w) => guessed.has(normalizeWord(w))).length === 3,
      );
      guesses.push({ words: [...move.words], correct: false, oneAway });
    }
  }

  const won = solvedIndices.size === content.categories.length;
  const gaveUp = !won && mistakes >= MAX_MISTAKES_ALLOWED;

  return {
    won,
    complete: won || gaveUp,
    mistakes,
    result: { solved, guesses, mistakes, won, gaveUp, lastMoveRepeated },
  };
}

function fits(category: ConnectionsBankEntry, word: string): boolean {
  return (
    category.words.includes(word) ||
    !!category.herrings?.includes(word) ||
    !!category.matches?.(word)
  );
}

/**
 * How many ways (up to `limit`) the 16 words can be split into the 4 categories, counting a
 * category as able to take any word that fits it — its own words, its known red herrings, or
 * anything its pattern matches. A fair grid has exactly 1.
 */
export function countGroupings(categories: readonly ConnectionsBankEntry[], limit = 2): number {
  const words = categories.flatMap((c) => c.words);
  let count = 0;

  function assign(index: number, remaining: readonly string[]): void {
    if (count >= limit) return;
    if (index === categories.length) {
      if (remaining.length === 0) count++;
      return;
    }
    const category = categories[index]!;
    const candidates = remaining.filter((w) => fits(category, w));
    // Choose 4 of the candidates for this category, then recurse on what's left.
    const choose = (start: number, picked: string[]): void => {
      if (count >= limit) return;
      if (picked.length === 4) {
        assign(
          index + 1,
          remaining.filter((w) => !picked.includes(w)),
        );
        return;
      }
      for (let i = start; i < candidates.length; i++) choose(i + 1, [...picked, candidates[i]!]);
    };
    choose(0, []);
  }

  assign(0, words);
  return count;
}

const TIERS = [4, 3, 2, 1] as const;

/**
 * One category per difficulty tier (yellow → purple), each tier ordered least-recently-used
 * first so content rotates through the whole bank. Tiers rotate independently — and the tiers
 * have different sizes — so the same four categories don't keep reappearing together. A
 * combination is skipped if two categories share a word or the grid could be grouped more than
 * one way; the hardest tier is chosen first since it has the fewest options.
 */
function pickCategories(
  rng: () => number,
  recentlyUsed: readonly string[],
): ConnectionsBankEntry[] {
  const ordered = TIERS.map((tier) => {
    const bank = CATEGORY_BANK.filter((c) => c.difficulty === tier);
    return pickLeastRecentlyUsed(rng, bank, (c) => c.title, recentlyUsed, bank.length);
  });

  const chosen: ConnectionsBankEntry[] = [];
  const search = (tierIndex: number): boolean => {
    if (tierIndex === ordered.length) return countGroupings(chosen) === 1;
    for (const candidate of ordered[tierIndex]!) {
      if (chosen.some((c) => c.words.some((w) => candidate.words.includes(w)))) continue;
      chosen.push(candidate);
      if (search(tierIndex + 1)) return true;
      chosen.pop();
    }
    return false;
  };
  if (!search(0)) throw new Error("Connections: no valid combination of categories in the bank");
  // Present yellow → purple, the order the answer key is conventionally revealed in.
  return [...chosen].sort((a, b) => a.difficulty - b.difficulty);
}

export const connectionsGame: DailyGameModule<
  ConnectionsContent,
  ConnectionsMove,
  ConnectionsResult
> = {
  id: "connections",
  name: "Connections",
  description: "Group 16 words into four hidden categories.",
  icon: "🟩",
  difficulty: "medium",

  contentSchema: z.object({
    categories: z
      .array(
        z.object({
          title: z.string(),
          difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
          words: z.tuple([z.string(), z.string(), z.string(), z.string()]),
        }),
      )
      .length(4),
    words: z.array(z.string()).length(16),
  }),

  moveSchema: z.object({ words: z.array(z.string()).length(4) }),

  generatePuzzle(_seed, dateKey, recentlyUsed = []) {
    const rng = createRng(`connections-${dateKey}`);
    const categories = pickCategories(rng, recentlyUsed).map(({ title, difficulty, words }) => ({
      title,
      difficulty,
      words: [...words] as ConnectionsCategory["words"],
    }));
    const words = shuffle(
      rng,
      categories.flatMap((category) => category.words),
    );

    return { categories, words };
  },

  contentIdentity(content) {
    return content.categories.map((c) => c.title);
  },

  validateAttempt(content, moves) {
    return replay(content, moves);
  },

  calculateScore(_content, result, meta) {
    if (!result.won) {
      // Gave up (ran out of mistakes) — partial credit for whatever was solved.
      return buildScoreBreakdown({ base: result.solved.length * 10 });
    }
    return buildScoreBreakdown({
      base: 60,
      mistakePenalty: result.mistakes * 10,
      accuracyBonus: result.mistakes === 0 ? 15 : 0,
      speedBonus: speedBonus(meta.durationMs, 30_000, 180_000, 25),
    });
  },

  sanitizeForClient(content, attempt) {
    if (!attempt) {
      return {
        words: content.words,
        solved: [],
        guesses: [],
        lastMoveRepeated: false,
        mistakesRemaining: MAX_MISTAKES_ALLOWED,
        complete: false,
      };
    }
    const { result, mistakes } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      words: content.words,
      solved: result.solved,
      // Safe to send: a "one away" flag only says what the player was just told anyway.
      guesses: result.guesses,
      lastMoveRepeated: result.lastMoveRepeated,
      mistakesRemaining: Math.max(0, MAX_MISTAKES_ALLOWED - mistakes),
      complete,
      ...(complete ? { categories: content.categories } : {}),
    };
  },

  revealAnswer(content) {
    const groups = [...content.categories]
      .sort((a, b) => a.difficulty - b.difficulty)
      .map(({ title, difficulty, words }) => ({ title, difficulty, words: [...words] }));
    return { kind: "groups", groups };
  },
};
