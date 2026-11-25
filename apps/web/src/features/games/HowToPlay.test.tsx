import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/render";
import { HowToPlay } from "./HowToPlay";
import { GAME_RULES } from "./rules";

beforeEach(() => localStorage.clear());

describe("HowToPlay", () => {
  it("opens by itself on a first visit, and only once", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <HowToPlay slug="connections" title="Connections" openOnFirstVisit />,
    );
    const dialog = await screen.findByRole("dialog", { name: "How to play Connections" });
    expect(dialog).toHaveTextContent(GAME_RULES.connections!.goal);
    expect(dialog).toHaveTextContent("4 mistakes");
    await user.click(screen.getByRole("button", { name: /Got it/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<HowToPlay slug="connections" title="Connections" openOnFirstVisit />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed until asked, then opens from the button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HowToPlay slug="pathway" title="Pathway" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "How to play Pathway" }));
    expect(screen.getByRole("dialog", { name: "How to play Pathway" })).toBeInTheDocument();
  });

  it("has rules for every game", () => {
    for (const slug of [
      "connections",
      "word-guess",
      "number-puzzle",
      "logic-puzzle",
      "guess-it",
      "pathway",
    ]) {
      expect(GAME_RULES[slug]?.steps.length, slug).toBeGreaterThan(1);
    }
  });
});

describe("HowToPlay inside a game that's still loading", () => {
  it("opens once the live board turns openOnFirstVisit on, not just on first render", async () => {
    localStorage.clear();
    const { rerender } = renderWithProviders(<HowToPlay slug="word-guess" title="Word Guess" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<HowToPlay slug="word-guess" title="Word Guess" openOnFirstVisit />);
    expect(
      await screen.findByRole("dialog", { name: "How to play Word Guess" }),
    ).toBeInTheDocument();
  });
});
