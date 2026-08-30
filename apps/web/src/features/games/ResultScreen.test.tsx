import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { ResultScreen } from "./ResultScreen";

const CATALOG = [
  { key: "FIRST_WIN", name: "First Win", description: "Win your first daily game.", icon: "🏆" },
  { key: "STREAK_3", name: "3 Day Streak", description: "Complete a game 3 days in a row.", icon: "🔥" },
];

function seedCatalog() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["achievements", "catalog"], CATALOG);
  return queryClient;
}

describe("ResultScreen", () => {
  it("shows a win state with the score and stats", () => {
    renderWithProviders(
      <ResultScreen gameName="Connections" won score={92} stats={[{ label: "Mistakes", value: "1" }]} />,
      seedCatalog(),
    );

    expect(screen.getByText("Nice work!")).toBeInTheDocument();
    expect(screen.getByText(/Score: 92/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Mistakes")).toBeInTheDocument();
  });

  it("shows a loss state with different copy", () => {
    renderWithProviders(<ResultScreen gameName="Word Guess" won={false} score={0} stats={[]} />, seedCatalog());
    expect(screen.getByText("So close!")).toBeInTheDocument();
  });

  it("shows only the achievements that were newly unlocked", () => {
    renderWithProviders(
      <ResultScreen gameName="Connections" won score={100} stats={[]} newAchievementKeys={["FIRST_WIN"]} />,
      seedCatalog(),
    );

    expect(screen.getByText("First Win")).toBeInTheDocument();
    expect(screen.queryByText("3 Day Streak")).not.toBeInTheDocument();
  });

  it("shows no achievement banners when nothing new was unlocked", () => {
    renderWithProviders(<ResultScreen gameName="Connections" won score={100} stats={[]} />, seedCatalog());
    expect(screen.queryByText("Achievement unlocked!")).not.toBeInTheDocument();
  });
});
