import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeDTO } from "@dailyloop/shared";
import { api, ApiClientError, setUnauthorizedHandler } from "./api-client";
import { useToast } from "./toast-context";
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

  // A 401 mid-session means the server no longer recognises us. Mark the user signed out so the
  // route guard sends them to login (which brings them back to this page afterwards), and drop
  // every cached query so nothing from the old session lingers.
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!queryClient.getQueryData(AUTH_QUERY_KEY)) return; // already signed out
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] });
      showToast("Your session has expired. Please log in again.", "info");
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient, showToast]);

  const value = useMemo(() => ({ user: data, isLoading }), [data, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
