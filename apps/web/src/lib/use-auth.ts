import { useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext, AUTH_QUERY_KEY, type AuthContextValue } from "./auth-context";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Call after login/register/logout/profile-edit so the rest of the app re-reads the session. */
export function useInvalidateAuth() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
}
