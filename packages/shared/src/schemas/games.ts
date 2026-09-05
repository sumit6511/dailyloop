import { z } from "zod";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
export const puzzleStatusSchema = z.enum(["SCHEDULED", "PUBLISHED", "ARCHIVED"]);

export const createPuzzleSchema = z.object({
  gameSlug: z.string().min(1),
  date: dateKeySchema,
  content: z.unknown(),
  status: puzzleStatusSchema.default("SCHEDULED"),
  publishAt: z.string().datetime().optional(),
});
export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

export const updatePuzzleSchema = z.object({
  content: z.unknown().optional(),
  status: puzzleStatusSchema.optional(),
  publishAt: z.string().datetime().nullable().optional(),
  date: dateKeySchema.optional(),
});
export type UpdatePuzzleInput = z.infer<typeof updatePuzzleSchema>;

export const generatePuzzleSchema = z.object({
  gameSlug: z.string().min(1),
  date: dateKeySchema,
});
export type GeneratePuzzleInput = z.infer<typeof generatePuzzleSchema>;

export const updateGameSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().min(1).max(200).optional(),
  icon: z.string().min(1).max(10).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
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
  /** Sanitized puzzle content, or null when unavailable or the game has no engine module yet. */
  content: unknown | null;
  /** When the current attempt began — ISO string, null before an attempt exists. Lets a client
   * compute an elapsed-time display that survives a page refresh instead of resetting to zero. */
  startedAt: string | null;
}
