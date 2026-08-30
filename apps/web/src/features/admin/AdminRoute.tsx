import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/use-auth";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}
