import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { FriendsPage } from "./FriendsPage";

afterEach(() => vi.restoreAllMocks());

describe("FriendsPage search", () => {
  it("searches once typing pauses, not on every keystroke", async () => {
    const searches: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/users/search")) searches.push(new URL(url).searchParams.get("q")!);
      const data = url.includes("/friends/requests") ? { incoming: [], outgoing: [] } : [];
      return new Response(JSON.stringify({ data }), {
        headers: { "content-type": "application/json" },
      });
    });
    const user = userEvent.setup();
    renderWithProviders(<FriendsPage />, createTestQueryClient());

    await user.type(await screen.findByLabelText("Find friends"), "sumit");
    await waitFor(() => expect(searches).toEqual(["sumit"]));
  });
});
