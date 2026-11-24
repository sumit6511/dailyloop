import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createTestQueryClient } from "../test/render";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./ToastProvider";
import { AUTH_QUERY_KEY } from "./auth-context";
import { api } from "./api-client";
import { ProtectedRoute } from "../features/layout/ProtectedRoute";

function GamePage() {
  const { error } = useQuery({
    queryKey: ["games", "x"],
    queryFn: () => api.get("/games/x/today"),
  });
  return <p>Game page {error ? "(errored)" : ""}</p>;
}

function LoginPage() {
  const location = useLocation();
  return <p>Login page, back to {(location.state as { from?: string } | null)?.from}</p>;
}

describe("an expired session mid-game", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the player to login (and back afterwards) with a message, instead of erroring in place", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(AUTH_QUERY_KEY, { id: "u1", username: "harry", displayName: "Harry" });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={["/play/x?from=share"]}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <GamePage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Login page, back to /play/x?from=share")).toBeInTheDocument();
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    expect(queryClient.getQueryData(["games", "x"])).toBeUndefined();
  });

  it("doesn't treat a 401 from /auth/* (the normal signed-out answer) as an expiry", async () => {
    const handler = vi.fn();
    const { setUnauthorizedHandler } = await import("./api-client");
    setUnauthorizedHandler(handler);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response("{}", { status: 401, headers: { "content-type": "application/json" } }),
    );
    await api.get("/auth/me").catch(() => {});
    expect(handler).not.toHaveBeenCalled();
    await api.get("/games/today").catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(null);
  });
});
