import { describe, it, expect } from "vitest";
import { analyzeNumbers, applyOp } from "./solver.js";

describe("applyOp", () => {
  it("only allows positive, whole-number results", () => {
    expect(applyOp(3, 5, "-")).toBeNull();
    expect(applyOp(5, 5, "-")).toBeNull();
    expect(applyOp(7, 2, "/")).toBeNull();
    expect(applyOp(8, 2, "/")).toBe(4);
  });
});

describe("analyzeNumbers", () => {
  const analysis = analyzeNumbers([2, 3, 4, 5]);

  it("includes each starting number as reachable with one number", () => {
    for (const n of [2, 3, 4, 5]) expect(analysis.get(n)?.minNumbers).toBe(1);
  });

  it("records the fewest numbers a value needs", () => {
    expect(analysis.get(20)?.minNumbers).toBe(2); // 4 × 5
    expect(analysis.get(120)?.minNumbers).toBe(4); // 2 × 3 × 4 × 5
  });

  it("treats a + b and b + a as the same way", () => {
    // 2 + 3 is the only two-number route to 5 besides the 5 itself.
    expect(analyzeNumbers([2, 3]).get(5)?.ways).toBe(1);
  });

  it("gives an expression that really evaluates to the value", () => {
    for (const [value, info] of analysis) {
      const js = info.expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      expect(Function(`return (${js});`)()).toBe(value);
    }
  });

  it("never reaches values the rules forbid", () => {
    for (const value of analysis.keys()) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(analyzeNumbers([1, 1]).has(0)).toBe(false);
  });
});
