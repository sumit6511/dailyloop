import { describe, it, expect } from "vitest";
import { clampScore, buildScoreBreakdown, speedBonus } from "./scoring.js";

describe("clampScore", () => {
  it("clamps to [0, 100] and rounds", () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(42.4)).toBe(42);
    expect(clampScore(42.6)).toBe(43);
  });
});

describe("buildScoreBreakdown", () => {
  it("sums parts into a clamped total", () => {
    const breakdown = buildScoreBreakdown({ base: 60, speedBonus: 20, accuracyBonus: 10, mistakePenalty: 5 });
    expect(breakdown.total).toBe(85);
  });

  it("never scores below 0 even with a large mistake penalty", () => {
    const breakdown = buildScoreBreakdown({ base: 20, mistakePenalty: 100 });
    expect(breakdown.total).toBe(0);
  });

  it("never scores above the per-game max even with generous bonuses", () => {
    const breakdown = buildScoreBreakdown({ base: 90, speedBonus: 50, accuracyBonus: 50 });
    expect(breakdown.total).toBe(100);
  });
});

describe("speedBonus", () => {
  it("gives the max bonus at or before the best time", () => {
    expect(speedBonus(5_000, 10_000, 60_000, 20)).toBe(20);
    expect(speedBonus(10_000, 10_000, 60_000, 20)).toBe(20);
  });

  it("gives zero at or after the worst time", () => {
    expect(speedBonus(60_000, 10_000, 60_000, 20)).toBe(0);
    expect(speedBonus(90_000, 10_000, 60_000, 20)).toBe(0);
  });

  it("falls off linearly between best and worst", () => {
    expect(speedBonus(35_000, 10_000, 60_000, 20)).toBe(10);
  });
});
