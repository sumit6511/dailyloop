import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface LeaderboardEntryDTO {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  rank: number;
}

export type LeaderboardRange = "daily" | "weekly" | "all-time";

export function useLeaderboard(range: LeaderboardRange) {
  return useQuery({
    queryKey: ["leaderboard", range],
    queryFn: () => api.get<LeaderboardEntryDTO[]>(`/leaderboard/${range}`),
  });
}

export function useFriendsLeaderboard(range: LeaderboardRange) {
  return useQuery({
    queryKey: ["leaderboard", "friends", range],
    queryFn: () => api.get<LeaderboardEntryDTO[]>(`/leaderboard/friends?range=${range}`),
  });
}

export interface MyRankDTO {
  rank: number;
  score: number;
  players: number;
}

/** Your own global rank for a range (null until you have a score in it). */
export function useMyRank(range: LeaderboardRange) {
  return useQuery({
    queryKey: ["leaderboard", "me", range],
    queryFn: () => api.get<MyRankDTO | null>(`/leaderboard/me?range=${range}`),
  });
}
