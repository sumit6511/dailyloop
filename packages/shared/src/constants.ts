/** Game identity is owned by the game-engine registry + the DB `Game` table, not this
 * package — keeping it a plain string means adding a new game never touches `shared`. */
export type GameSlug = string;

export const SCORE = {
  PER_GAME_MAX: 100,
  PERFECT_DAY_BONUS: 50,
  /** Deducted from a game's score per distinct hint revealed (games that offer hints). */
  HINT_PENALTY: 10,
} as const;

/**
 * Active-time tracking for games that pause their clock when the player leaves. The server adds
 * the gap between consecutive pieces of activity (moves, hints, heartbeats) to an attempt's
 * active time only when that gap is at most MAX_GAP_MS; a longer gap means the player was away.
 * Clients send a heartbeat every HEARTBEAT_MS while the puzzle is on screen.
 */
export const ACTIVE_TIME = {
  HEARTBEAT_MS: 15_000,
  MAX_GAP_MS: 45_000,
} as const;

export const SESSION_COOKIE_NAME = "dp_session";
export const SESSION_DURATION_DAYS = 30;

export const MAX_MISTAKES = {
  connections: 4,
} as const;

/** Usernames that would collide with routes (e.g. GET /users/me) or read as official accounts. */
export const RESERVED_USERNAMES = [
  "me",
  "admin",
  "api",
  "null",
  "undefined",
  "support",
  "dailyloop",
  "root",
  "system",
];
