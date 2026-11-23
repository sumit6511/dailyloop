import { dateKeyToJSDate } from "@dailyloop/shared";

/** Difficulty tier for procedurally generated puzzles. */
export type PuzzleTier = "easy" | "medium" | "hard";

// Index = JS day of week (0 = Sunday). Ramps through the week the way NYT/LinkedIn puzzles do:
// a gentle start to the week, the toughest puzzles on Friday–Sunday when people have more time.
const TIER_BY_WEEKDAY: readonly PuzzleTier[] = [
  "hard",
  "easy",
  "easy",
  "medium",
  "medium",
  "hard",
  "hard",
];

/**
 * The difficulty tier for a calendar date — derived purely from the date key, so every server
 * (and every regeneration of the same date) agrees on it. Procedural games use this to scale
 * grid size, clue count, etc.; fixed-content-bank games can ignore it.
 */
export function tierForDate(dateKey: string): PuzzleTier {
  return TIER_BY_WEEKDAY[dateKeyToJSDate(dateKey).getUTCDay()]!;
}
