/** Game identity is owned by the game-engine registry + the DB `Game` table, not this
 * package — keeping it a plain string means adding a new game never touches `shared`. */
export type GameSlug = string;

export const SCORE = {
  PER_GAME_MAX: 100,
  PERFECT_DAY_BONUS: 50,
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
