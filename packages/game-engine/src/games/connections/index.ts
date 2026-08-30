import { z } from "zod";
import { dateKeyToJSDate, MAX_MISTAKES } from "@dailyloop/shared";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { shuffle, createRng } from "../../rng.js";
import { CATEGORY_BANK, type ConnectionsCategory } from "./categories.js";

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

export interface ConnectionsResult {
  solved: SolvedGroup[];
  mistakes: number;
  won: boolean;
  gaveUp: boolean;
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

function replay(content: ConnectionsContent, moves: ConnectionsMove[]): ValidationResult<ConnectionsResult> {
  const solved: SolvedGroup[] = [];
  const solvedIndices = new Set<number>();
  let mistakes = 0;

  for (const move of moves) {
    const matchIndex = content.categories.findIndex(
      (category, index) => !solvedIndices.has(index) && sameWordSet(category.words, move.words),
    );
    if (matchIndex >= 0) {
      solvedIndices.add(matchIndex);
      const category = content.categories[matchIndex]!;
      solved.push({ categoryIndex: matchIndex, title: category.title, difficulty: category.difficulty, words: [...category.words] });
    } else {
      mistakes++;
    }
  }

  const won = solvedIndices.size === content.categories.length;
  const gaveUp = !won && mistakes >= MAX_MISTAKES_ALLOWED;

  return { won, complete: won || gaveUp, mistakes, result: { solved, mistakes, won, gaveUp } };
}

function daysSinceEpoch(dateKey: string): number {
  return Math.floor(dateKeyToJSDate(dateKey).getTime() / 86_400_000);
}

export const connectionsGame: DailyGameModule<ConnectionsContent, ConnectionsMove, ConnectionsResult> = {
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

  generatePuzzle(_seed, dateKey) {
    const bankSize = CATEGORY_BANK.length;
    const startIndex = (daysSinceEpoch(dateKey) * 4) % bankSize;
    const categories = Array.from({ length: 4 }, (_, i) => CATEGORY_BANK[(startIndex + i) % bankSize]!);

    const rng = createRng(`connections-${dateKey}`);
    const words = shuffle(rng, categories.flatMap((category) => category.words));

    return { categories, words };
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
      return { words: content.words, solved: [], mistakesRemaining: MAX_MISTAKES_ALLOWED, complete: false };
    }
    const { result, mistakes } = replay(content, attempt.moves);
    const complete = attempt.status === "COMPLETED";
    return {
      words: content.words,
      solved: result.solved,
      mistakesRemaining: Math.max(0, MAX_MISTAKES_ALLOWED - mistakes),
      complete,
      ...(complete ? { categories: content.categories } : {}),
    };
  },
};
