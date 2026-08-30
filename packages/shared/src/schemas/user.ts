import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().trim().max(200).optional(),
  avatarUrl: z.string().max(500).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

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
