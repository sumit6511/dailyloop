import * as z from "zod/mini"; // see schemas/auth.ts for why mini

const dateKeySchema = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"));
export const puzzleStatusSchema = z.enum(["SCHEDULED", "PUBLISHED", "ARCHIVED"]);

export const createPuzzleSchema = z.object({
  gameSlug: z.string().check(z.minLength(1)),
  date: dateKeySchema,
  content: z.unknown(),
  status: z._default(puzzleStatusSchema, "SCHEDULED"),
  publishAt: z.optional(z.iso.datetime()),
});
export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

export const updatePuzzleSchema = z.object({
  content: z.optional(z.unknown()),
  status: z.optional(puzzleStatusSchema),
  publishAt: z.optional(z.nullable(z.iso.datetime())),
  date: z.optional(dateKeySchema),
});
export type UpdatePuzzleInput = z.infer<typeof updatePuzzleSchema>;

export const generatePuzzleSchema = z.object({
  gameSlug: z.string().check(z.minLength(1)),
  date: dateKeySchema,
});
export type GeneratePuzzleInput = z.infer<typeof generatePuzzleSchema>;

export const updateGameSchema = z.object({
  name: z.optional(z.string().check(z.minLength(1), z.maxLength(60))),
  description: z.optional(z.string().check(z.minLength(1), z.maxLength(200))),
  icon: z.optional(z.string().check(z.minLength(1), z.maxLength(10))),
  difficulty: z.optional(z.enum(["easy", "medium", "hard"])),
  isEnabled: z.optional(z.boolean()),
  sortOrder: z.optional(z.int()),
});
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

export interface GameDTO {
  slug: string;
  name: string;
  description: string;
  icon: string;
  difficulty: string;
}

export type TodayGameStatus = "not_started" | "in_progress" | "completed";

export interface TodayGameEntryDTO {
  slug: string;
  name: string;
  description: string;
  icon: string;
  difficulty: string;
  /** False when this game has no published puzzle for today (e.g. temporarily out of content). */
  available: boolean;
  puzzleNumber: number | null;
  status: TodayGameStatus;
  score: number | null;
  mistakeCount: number | null;
  /** Hints charged to the current attempt (they lower its score); null before an attempt exists. */
  hintsUsed: number | null;
  /** Active play time so far (see ACTIVE_TIME) — what a pausable timer should display and what
   * games with active timing are scored on. Null before an attempt exists. */
  activeMs: number | null;
  /** Sanitized puzzle content, or null when unavailable or the game has no engine module yet. */
  content: unknown | null;
  /** When the current attempt began — ISO string, null before an attempt exists. Lets a client
   * compute an elapsed-time display that survives a page refresh instead of resetting to zero. */
  startedAt: string | null;
}
