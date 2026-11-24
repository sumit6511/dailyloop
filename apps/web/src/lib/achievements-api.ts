import { useQuery } from "@tanstack/react-query";
import { isIconName, type IconName } from "@dailyloop/shared";
import { api } from "./api-client";

export interface AchievementDTO {
  key: string;
  name: string;
  description: string;
  icon: string;
}

/** Achievement icons arrive from the API as plain strings; anything outside the font subset
 * would render as its raw name, so fall back to a trophy. */
export function achievementIcon(icon: string): IconName {
  return isIconName(icon) ? icon : "emoji_events";
}

export function useAchievementCatalog() {
  return useQuery({
    queryKey: ["achievements", "catalog"],
    queryFn: () => api.get<AchievementDTO[]>("/achievements"),
    staleTime: Infinity,
  });
}

export interface UnlockedAchievementDTO extends AchievementDTO {
  unlockedAt: string;
}

export function useMyAchievements() {
  return useQuery({
    queryKey: ["me", "achievements"],
    queryFn: () => api.get<UnlockedAchievementDTO[]>("/me/achievements"),
  });
}

export function useUserAchievements(username: string | undefined) {
  return useQuery({
    queryKey: ["users", username, "achievements"],
    queryFn: () => api.get<UnlockedAchievementDTO[]>(`/users/${username}/achievements`),
    enabled: !!username,
  });
}
