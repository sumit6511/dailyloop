import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../test/render";
import { useSubmitMove } from "./games-api";

afterEach(() => vi.restoreAllMocks());

function setup(complete: boolean) {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ data: { complete, content: {} } }), {
        headers: { "content-type": "application/json" },
      }),
  );
  const queryClient = createTestQueryClient();
  for (const key of [
    ["games", "today"],
    ["leaderboard", "daily"],
    ["me", "streak"],
    ["users", "harry", "activity"],
    ["friends"],
  ]) {
    queryClient.setQueryData(key, { cached: true });
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSubmitMove("word-guess"), { wrapper });
  const stale = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
  return { result, stale };
}

describe("useSubmitMove", () => {
  it("refreshes leaderboards, streak and profiles once a game is finished", async () => {
    const { result, stale } = setup(true);
    await act(() => result.current.mutateAsync({ guess: "CRANE" }));
    expect(stale(["leaderboard", "daily"])).toBe(true);
    expect(stale(["me", "streak"])).toBe(true);
    expect(stale(["users", "harry", "activity"])).toBe(true);
    expect(stale(["games", "today"])).toBe(true);
    expect(stale(["friends"])).toBe(false);
  });

  it("only refreshes the game while it's still in play", async () => {
    const { result, stale } = setup(false);
    await act(() => result.current.mutateAsync({ guess: "SLATE" }));
    expect(stale(["games", "today"])).toBe(true);
    expect(stale(["leaderboard", "daily"])).toBe(false);
    expect(stale(["me", "streak"])).toBe(false);
  });
});
