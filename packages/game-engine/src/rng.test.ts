import { describe, it, expect } from "vitest";
import { createRng, randInt, shuffle, pickN, pickLeastRecentlyUsed, hashSeed } from "./rng.js";

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

describe("pickLeastRecentlyUsed", () => {
  it("prefers never-used items over any listed as recently used", () => {
    const rng = createRng("lru-check-1");
    const items = ["a", "b", "c", "d", "e"];
    const result = pickLeastRecentlyUsed(rng, items, (x) => x, ["a", "b", "c", "d"], 1);
    expect(result).toEqual(["e"]);
  });

  it("ranks an identity by its LAST occurrence, not its first", () => {
    // "a" appears early (looks stale) but also very late (actually the most recently used) —
    // a naive indexOf-based implementation would wrongly prefer "a" over "b".
    const rng = createRng("lru-check-2");
    const items = ["a", "b"];
    const recentlyUsedOldestFirst = ["a", "b", "a"]; // "a" used again after "b" — "a" is more recent
    const result = pickLeastRecentlyUsed(rng, items, (x) => x, recentlyUsedOldestFirst, 1);
    expect(result).toEqual(["b"]);
  });

  it("returns count distinct items with no duplicates", () => {
    const rng = createRng("lru-check-3");
    const result = pickLeastRecentlyUsed(rng, ["a", "b", "c", "d", "e"], (x) => x, ["a", "c"], 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });

  it("is deterministic for the same rng seed and inputs", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const a = pickLeastRecentlyUsed(createRng("lru-determinism"), items, (x) => x, [], 3);
    const b = pickLeastRecentlyUsed(createRng("lru-determinism"), items, (x) => x, [], 3);
    expect(a).toEqual(b);
  });
});
