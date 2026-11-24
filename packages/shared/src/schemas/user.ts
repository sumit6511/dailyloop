import * as z from "zod/mini"; // see schemas/auth.ts for why mini

export const updateProfileSchema = z.object({
  displayName: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(40))),
  bio: z.optional(z.string().check(z.trim(), z.maxLength(200))),
  /** An https image URL, or "" to clear it — never javascript:/data:/plain-http URLs. */
  avatarUrl: z.optional(
    z.union([
      z.literal(""),
      z.pipe(
        z.string().check(z.trim(), z.maxLength(500)),
        z
          .url()
          .check(
            z.refine((url) => url.startsWith("https://"), "Avatar URL must start with https://"),
          ),
      ),
    ]),
  ),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().check(z.minLength(1, "Enter your password to confirm"), z.maxLength(72)),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export interface PublicUserDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserStatsDTO {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface MeDTO extends PublicUserDTO {
  email: string;
  role: "USER" | "ADMIN";
  timezone: string;
}

export interface GameStatsDTO {
  slug: string;
  name: string;
  icon: string;
  played: number;
  won: number;
  /** 0–100, rounded; 0 when nothing has been played yet. */
  winRate: number;
  averageScore: number;
  bestScore: number;
}

export interface MyStatsDTO {
  games: GameStatsDTO[];
  /** Word Guess wins by number of guesses: index 0 = solved in 1 guess … index 5 = in 6. */
  wordGuessDistribution: number[];
}
