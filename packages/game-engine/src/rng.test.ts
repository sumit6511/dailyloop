import { describe, it, expect } from "vitest";
import { createRng, randInt, shuffle, pickN, hashSeed } from "./rng.js";

describe("hashSeed", () => {
  it("is deterministic for the same input", () => {
    expect(hashSeed("connections-2026-08-29")).toBe(hashSeed("connections-2026-08-29"));
  });

  it("differs for different inputs", () => {
    expect(hashSeed("connections-2026-08-29")).not.toBe(hashSeed("connections-2026-08-30"));
  });
});

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng("word-guess-2026-08-29");
    const b = createRng("word-guess-2026-08-29");
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng("seed-a");
    const b = createRng("seed-b");
    expect(a()).not.toBe(b());
  });
});

describe("randInt", () => {
  it("stays within [min, max] inclusive", () => {
    const rng = createRng("bounds-check");
    for (let i = 0; i < 200; i++) {
      const value = randInt(rng, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });
});

describe("shuffle", () => {
  it("returns a permutation and does not mutate the input", () => {
    const rng = createRng("shuffle-check");
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(rng, input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("pickN", () => {
  it("returns the requested count of distinct items", () => {
    const rng = createRng("pick-check");
    const result = pickN(rng, ["a", "b", "c", "d", "e"], 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });
});
