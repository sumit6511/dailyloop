import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface AchievementDTO {
  key: string;
  name: string;
  description: string;
  icon: string;
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
