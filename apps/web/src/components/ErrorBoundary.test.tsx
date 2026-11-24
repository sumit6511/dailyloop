import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("Boom");
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a fallback instead of crashing when a child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("page variant shows the error in place and recovers with Try again", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Flaky() {
      if (broken) throw new Error("Boom");
      return <p>Recovered</p>;
    }
    render(
      <MemoryRouter>
        <ErrorBoundary variant="page">
          <Flaky />
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("This page ran into a problem")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to today" })).toHaveAttribute("href", "/");
    broken = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("clears a caught error when resetKey changes (navigating to another page)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <MemoryRouter>
        <ErrorBoundary variant="page" resetKey="/play/broken">
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("This page ran into a problem")).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ErrorBoundary variant="page" resetKey="/friends">
          <p>Friends page</p>
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("Friends page")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
