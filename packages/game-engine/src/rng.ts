/** Deterministic 32-bit string hash — good enough to turn a "date+slug" seed into a PRNG seed. */
export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, good-enough-for-puzzles seeded PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedString: string): () => number {
  return mulberry32(hashSeed(seedString));
}

/** Random integer in [min, max], inclusive. */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Fisher-Yates shuffle — does not mutate the input. */
export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/** Pick `count` distinct items deterministically. */
export function pickN<T>(rng: () => number, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}
