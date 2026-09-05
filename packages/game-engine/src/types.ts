import type { ZodType } from "zod";

export type Difficulty = "easy" | "medium" | "hard";

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  accuracyBonus: number;
  mistakePenalty: number;
  /** Final per-game score, clamped to [0, SCORE.PER_GAME_MAX]. */
  total: number;
}

/**
 * Only what genuinely can't come from the game's own replayed move history —
 * server-measured wall-clock time (now - attempt.startedAt), never a client-reported value.
 */
export interface ScoreMeta {
  durationMs: number;
}

export interface ValidationResult<TResult> {
  won: boolean;
  /** True once the attempt is over (won, or out of tries/time) — drives whether to score it. */
  complete: boolean;
  /** Common enough across games to live at the top level instead of inside each TResult. */
  mistakes: number;
  result: TResult;
}

export type AttemptStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

/** The user's current progress on a puzzle, as far as sanitizeForClient needs to know. */
export interface AttemptState<TMove = unknown> {
  status: AttemptStatus;
  /** Full move history so far, oldest first. */
  moves: TMove[];
}

export interface DailyGameModule<TContent = unknown, TMove = unknown, TResult = unknown> {
  /** Slug — must match the corresponding `Game.slug` DB row. */
  id: string;
  name: string;
  description: string;
  icon: string;
  difficulty: Difficulty;
  contentSchema: ZodType<TContent>;
  /** Shape of a single incoming move (one Connections group guess, one Wordle guess, ...). */
  moveSchema: ZodType<TMove>;
  /** Deterministic: same (seed, dateKey) must always produce the same content. */
  generatePuzzle(seed: string, dateKey: string): TContent;
  /**
   * Re-derives complete state from the full move history every time (not just the latest
   * move) — moves are replayed from scratch rather than trusting incrementally-cached state,
   * so a client can never desync the server's idea of solved-groups/mistakes/etc.
   */
  validateAttempt(content: TContent, moves: TMove[]): ValidationResult<TResult>;
  calculateScore(content: TContent, result: TResult, meta: ScoreMeta): ScoreBreakdown;
  /**
   * Strips answers from `content` for a client, based on how far `attempt` has progressed —
   * e.g. Guess It reveals clues up to the count already used, Connections reveals only solved
   * groups, and a COMPLETED attempt can safely reveal everything. `attempt` is null when the
   * user hasn't started yet, which should reveal the least.
   */
  sanitizeForClient(content: TContent, attempt: AttemptState<TMove> | null): unknown;
  /**
   * Optional: lets a client ask "is what I've filled in so far correct?" without revealing the
   * solution. Most games omit this — a wrong guess is already immediate feedback for e.g.
   * Connections/Word Guess — and the route responds with a 400 for any game that doesn't define
   * it.
   */
  checkProgress?(content: TContent, moves: TMove[]): unknown;
  /**
   * Optional: a read-only suggestion for what to do next — e.g. Logic Puzzle deduces a
   * currently-solvable cell+value via Sudoku logic. Never touches the move log or game state;
   * games that don't support this simply omit it, and the route responds with a 400.
   */
  hint?(content: TContent, moves: TMove[]): unknown;
}

// The registry/API layer manages many different games generically and can't know each
// one's concrete TContent/TMove/TResult — this type-erased view is the intentional
// escape hatch for that, matched by runtime validation via each module's own zod schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDailyGameModule = DailyGameModule<any, any, any>;
