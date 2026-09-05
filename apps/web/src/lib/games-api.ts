import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayGameEntryDTO } from "@dailyloop/shared";
import { api } from "./api-client";

export function useTodayLineup() {
  return useQuery({
    queryKey: ["games", "today"],
    queryFn: () => api.get<TodayGameEntryDTO[]>("/games/today"),
  });
}

export function useGameToday(slug: string) {
  return useQuery({
    queryKey: ["games", slug, "today"],
    queryFn: () => api.get<TodayGameEntryDTO>(`/games/${slug}/today`),
  });
}

interface StartResponse {
  status: string;
  content: unknown;
}

export function useStartAttempt(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StartResponse>(`/games/${slug}/attempts/start`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["games", slug, "today"] });
    },
  });
}

/** Kicks off an attempt the first time a game page sees "not_started" — no explicit Start button. */
export function useAutoStartAttempt(slug: string, status: TodayGameEntryDTO["status"] | undefined) {
  const startAttempt = useStartAttempt(slug);
  useEffect(() => {
    if (status === "not_started" && startAttempt.isIdle) {
      startAttempt.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}

export interface SubmitMoveResponse {
  complete: boolean;
  won?: boolean;
  score?: number | null;
  content: unknown;
  alreadyCompleted?: boolean;
  newlyUnlockedAchievements?: string[];
}

export function useSubmitMove(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: unknown) => api.post<SubmitMoveResponse>(`/games/${slug}/attempts/submit`, { move }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["games", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["games", slug, "today"] });
    },
  });
}

/** Not every game supports this — the API responds 400 for ones that don't (see checkProgress). */
export function useCheckProgress<T>(slug: string) {
  return useMutation({
    mutationFn: () => api.post<T>(`/games/${slug}/attempts/check`),
  });
}

/** Read-only "what's a legal next move?" suggestion — not every game supports this (see getHint). */
export function useHint<T>(slug: string) {
  return useMutation({
    mutationFn: () => api.post<T>(`/games/${slug}/attempts/hint`),
  });
}

interface UndoResponse {
  content: unknown;
}

/** Not every game supports this — the API responds 400 for ones that don't (see undoLastMove). */
export function useUndoMove(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<UndoResponse>(`/games/${slug}/attempts/undo`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["games", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["games", slug, "today"] });
    },
  });
}
