import { createContext } from "react";
import type { MeDTO } from "@dailyloop/shared";

export interface AuthContextValue {
  /** undefined = still loading, null = signed out */
  user: MeDTO | null | undefined;
  isLoading: boolean;
}

export const AUTH_QUERY_KEY = ["auth", "me"] as const;
export const AuthContext = createContext<AuthContextValue | null>(null);
