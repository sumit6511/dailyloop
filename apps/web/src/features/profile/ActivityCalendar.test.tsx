import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { addDaysToKey, type ActivityDTO } from "@dailyloop/shared";
import { renderWithProviders } from "../../test/render";
import { ActivityCalendar } from "./ActivityCalendar";

afterEach(() => vi.restoreAllMocks());

const TO = "2026-11-25"; // a Wednesday
const FROM = addDaysToKey(TO, -83); // 2026-09-03, a Thursday

function serve(played: Record<string, { points: number; games: number; perfect?: boolean }>) {
  const days = Array.from({ length: 84 }, (_, i) => {
    const date = addDaysToKey(FROM, i);
    const p = played[date];
    return {
      date,
      points: p?.points ?? 0,
      gamesCompleted: p?.games ?? 0,
      perfectDay: p?.perfect ?? false,
    };
  });
  const data: ActivityDTO = { from: FROM, to: TO, days };
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } }),
  );
}

describe("ActivityCalendar", () => {
  it("summarises the 12 weeks and labels each day", async () => {
    serve({
      [TO]: { points: 650, games: 6, perfect: true },
      [addDaysToKey(TO, -2)]: { points: 120, games: 2 },
    });
    renderWithProviders(<ActivityCalendar username="harry" />);

    const calendar = await screen.findByRole("img", {
      name: "2 of 84 days played in the last 12 weeks, best day 650 points, 1 perfect day.",
    });
    expect(
      calendar.querySelector('[title="Wed 25 Nov: 650 points, 6 games, perfect day"]'),
    ).not.toBeNull();
    expect(calendar.querySelector('[title="Mon 23 Nov: 120 points, 2 games"]')).not.toBeNull();
    expect(calendar.querySelectorAll("[title]")).toHaveLength(84);
  });

  it("lines the first column up on Monday", async () => {
    serve({});
    renderWithProviders(<ActivityCalendar username="harry" />);
    const calendar = await screen.findByRole("img", { name: /^0 of 84 days played/ });
    // 3 Sep 2026 is a Thursday: Monday–Wednesday of that week are blank padding.
    const children = Array.from(calendar.children);
    expect(children.slice(0, 3).every((cell) => !cell.hasAttribute("title"))).toBe(true);
    expect(children[3]).toHaveAttribute("title", "Thu 3 Sept: not played");
  });
});
