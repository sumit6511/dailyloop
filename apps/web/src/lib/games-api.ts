import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayGameEntryDTO, YesterdayAnswersDTO } from "@dailyloop/shared";
import { api } from "./api-client";

export interface ScheduleDTO {
  /** The server's "today" (YYYY-MM-DD) in the puzzle timezone. */
  today: string;
  timezone: string;
  /** When tomorrow's puzzles go live (ISO instant). */
  nextRolloverAt: string;
  /** Server clock at response time — lets the client correct for its own clock skew. */
  serverTime: string;
}

export function useSchedule() {
  return useQuery({
    queryKey: ["games", "schedule"],
    queryFn: async () => {
      const data = await api.get<ScheduleDTO>("/games/schedule");
      return { ...data, clockSkewMs: Date.parse(data.serverTime) - Date.now() };
    },
    staleTime: 5 * 60_000,
  });
}

export function useTodayLineup() {
  return useQuery({
    queryKey: ["games", "today"],
    queryFn: () => api.get<TodayGameEntryDTO[]>("/games/today"),
  });
}

export function useYesterdayAnswers() {
  return useQuery({
    queryKey: ["games", "yesterday"],
    queryFn: () => api.get<YesterdayAnswersDTO>("/games/yesterday"),
    staleTime: 10 * 60_000,
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
    mutationFn: (move: unknown) =>
      api.post<SubmitMoveResponse>(`/games/${slug}/attempts/submit`, { move }),
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

export interface HintResponse<T> {
  /** null when the game has nothing to suggest right now (nothing is charged then). */
  hint: T | null;
  /** Hints charged to this attempt so far — each lowers the score (see SCORE.HINT_PENALTY). */
  hintsUsed: number;
}

/** A "what's a good next move?" suggestion. Not free: the server charges each distinct hint to
 * the attempt's score. Not every game supports this — the API responds 400 for ones that don't. */
export function useHint<T>(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<HintResponse<T>>(`/games/${slug}/attempts/hint`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["games", slug, "today"] });
    },
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
