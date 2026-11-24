import { createContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { MeDTO } from "@dailyloop/shared";

export interface AuthContextValue {
  /** undefined = still loading, null = signed out */
  user: MeDTO | null | undefined;
  isLoading: boolean;
}

export const AUTH_QUERY_KEY = ["auth", "me"] as const;
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The session is over (logout, password change, account deletion, or the server stopped
 * recognising it): mark the user signed out and drop every other cached response. They belonged
 * to that user, and the next person to sign in on this tab mustn't be shown them, even briefly.
 */
export function forgetSession(queryClient: QueryClient): void {
  queryClient.setQueryData(AUTH_QUERY_KEY, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] });
}
