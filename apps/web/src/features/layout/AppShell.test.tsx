import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import type { MeDTO } from "@dailyloop/shared";
import { AuthContext, AUTH_QUERY_KEY } from "../../lib/auth-context";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { AppShell } from "./AppShell";

afterEach(() => vi.restoreAllMocks());

const me = { id: "u1", username: "harry", displayName: "Harry", role: "USER" } as MeDTO;

describe("logging out", () => {
  it("forgets everything cached for that player, so the next sign-in on this tab starts clean", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { ok: true, incoming: [], outgoing: [] } }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(AUTH_QUERY_KEY, me);
    queryClient.setQueryData(["leaderboard", "friends", "today"], [{ username: "ron" }]);
    const user = userEvent.setup();

    renderWithProviders(
      <AuthContext.Provider value={{ user: me, isLoading: false }}>
        <Routes>
          <Route path="/" element={<AppShell>Dashboard</AppShell>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthContext.Provider>,
      queryClient,
    );

    await user.click(screen.getAllByRole("button", { name: /Log out/ })[0]!);

    await screen.findByText("Login page");
    expect(queryClient.getQueryData(AUTH_QUERY_KEY)).toBeNull();
    expect(queryClient.getQueryData(["leaderboard", "friends", "today"])).toBeUndefined();
  });
});
