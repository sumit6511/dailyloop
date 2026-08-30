import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MeDTO } from "@dailyloop/shared";
import { api, ApiClientError } from "./api-client";
import { AuthContext, AUTH_QUERY_KEY } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await api.get<MeDTO>("/auth/me");
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });

  const value = useMemo(() => ({ user: data, isLoading }), [data, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
