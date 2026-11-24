import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import type { MeDTO } from "@dailyloop/shared";
import { AuthContext } from "../../lib/auth-context";
import { renderWithProviders } from "../../test/render";
import { SettingsPage } from "./SettingsPage";

afterEach(() => vi.restoreAllMocks());

const me: MeDTO = {
  id: "u1",
  username: "harry",
  displayName: "Harry",
  avatarUrl: null,
  bio: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "harry@example.com",
  role: "USER",
  timezone: "UTC",
};

function renderSettings() {
  renderWithProviders(
    <AuthContext.Provider value={{ user: me, isLoading: false }}>
      <Routes>
        <Route path="/" element={<SettingsPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </AuthContext.Provider>,
  );
}

function mockDelete(respond: (body: unknown) => Response) {
  const calls: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ method: init?.method, body });
    return respond(body);
  });
  return calls;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("SettingsPage account deletion", () => {
  it("asks for confirmation, sends the password, then leaves for the login page", async () => {
    const calls = mockDelete(() => json(200, { data: { ok: true } }));
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("Confirm with your password"), "my-password");
    await user.click(screen.getByRole("button", { name: /Delete account/ }));
    expect(calls).toEqual([]); // nothing happens until the dialog is confirmed

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Delete forever/ }));

    await screen.findByText("Login page");
    expect(calls).toEqual([{ method: "DELETE", body: { password: "my-password" } }]);
  });

  it("shows a wrong password next to the field and stays put", async () => {
    mockDelete(() =>
      json(400, { error: { code: "BAD_REQUEST", message: "Password is incorrect" } }),
    );
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("Confirm with your password"), "nope");
    await user.click(screen.getByRole("button", { name: /Delete account/ }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Delete forever/ }),
    );

    expect(await screen.findByText("Password is incorrect")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("doesn't open the confirmation without a password", async () => {
    const calls = mockDelete(() => json(200, { data: { ok: true } }));
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /Delete account/ }));
    expect(await screen.findByText("Enter your password to confirm")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});
