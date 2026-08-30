import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export interface AdminGameDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  difficulty: string;
  isEnabled: boolean;
  sortOrder: number;
}

export interface AdminPuzzleDTO {
  id: string;
  gameSlug: string;
  gameName: string;
  date: string;
  puzzleNumber: number;
  status: "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  publishAt: string | null;
  content: unknown;
}

export interface AdminUserDTO {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  currentStreak: number;
  gamesPlayed: number;
  totalPoints: number;
}

export interface AdminStatsOverviewDTO {
  totalUsers: number;
  totalAttempts: number;
  completedAttempts: number;
  games: {
    slug: string;
    name: string;
    isEnabled: boolean;
    puzzleCount: number;
    completedCount: number;
    averageScore: number;
  }[];
}

export interface AdminActivityDTO {
  date: string;
  activeUsers: number;
  perfectDays: number;
  totalAttempts: number;
  completedAttempts: number;
  topScores: { username: string; score: number; isPerfectDay: boolean }[];
}

export function useAdminGames() {
  return useQuery({ queryKey: ["admin", "games"], queryFn: () => api.get<AdminGameDTO[]>("/admin/games") });
}

export function useUpdateAdminGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<AdminGameDTO, "isEnabled" | "sortOrder">> }) =>
      api.patch(`/admin/games/${id}`, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "games"] }),
  });
}

export interface PuzzleFilters {
  gameSlug?: string;
  date?: string;
  status?: string;
}

export function useAdminPuzzles(filters: PuzzleFilters) {
  const params = new URLSearchParams();
  if (filters.gameSlug) params.set("gameSlug", filters.gameSlug);
  if (filters.date) params.set("date", filters.date);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin", "puzzles", filters],
    queryFn: () => api.get<AdminPuzzleDTO[]>(`/admin/puzzles${qs ? `?${qs}` : ""}`),
  });
}

function useInvalidatePuzzles() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["admin", "puzzles"] });
}

export function useCreatePuzzle() {
  const invalidate = useInvalidatePuzzles();
  return useMutation({
    mutationFn: (data: { gameSlug: string; date: string; status: string; content: unknown }) =>
      api.post<AdminPuzzleDTO>("/admin/puzzles", data),
    onSuccess: invalidate,
  });
}

export function useGeneratePuzzle() {
  const invalidate = useInvalidatePuzzles();
  return useMutation({
    mutationFn: (data: { gameSlug: string; date: string }) =>
      api.post<AdminPuzzleDTO>("/admin/puzzles/generate", data),
    onSuccess: invalidate,
  });
}

export function useUpdatePuzzle() {
  const invalidate = useInvalidatePuzzles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content?: unknown; status?: string; date?: string } }) =>
      api.put<AdminPuzzleDTO>(`/admin/puzzles/${id}`, data),
    onSuccess: invalidate,
  });
}

export function useDeletePuzzle() {
  const invalidate = useInvalidatePuzzles();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/puzzles/${id}`),
    onSuccess: invalidate,
  });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: () => api.get<AdminUserDTO[]>("/admin/users") });
}

export function useAdminStatsOverview() {
  return useQuery({
    queryKey: ["admin", "stats", "overview"],
    queryFn: () => api.get<AdminStatsOverviewDTO>("/admin/stats/overview"),
  });
}

export function useAdminActivity(date?: string) {
  return useQuery({
    queryKey: ["admin", "activity", date],
    queryFn: () => api.get<AdminActivityDTO>(`/admin/activity${date ? `?date=${date}` : ""}`),
  });
}
