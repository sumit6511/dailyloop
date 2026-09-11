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

/**
 * Picks `count` items from a fixed content bank, preferring ones that haven't been used
 * recently. `recentlyUsedOldestFirst` lists prior identities oldest-first (an identity can
 * appear more than once across a long history — only its *last* occurrence matters); an
 * identity that never appears ranks ahead of everything that has. The rng shuffles first so
 * ties (all "never used") aren't broken in bank order every time.
 */
export function pickLeastRecentlyUsed<T>(
  rng: () => number,
  items: readonly T[],
  identityOf: (item: T) => string,
  recentlyUsedOldestFirst: readonly string[],
  count: number,
): T[] {
  const lastSeenIndex = new Map<string, number>();
  recentlyUsedOldestFirst.forEach((id, i) => lastSeenIndex.set(id, i)); // later overwrites earlier
  return shuffle(rng, items)
    .sort((a, b) => (lastSeenIndex.get(identityOf(a)) ?? -1) - (lastSeenIndex.get(identityOf(b)) ?? -1))
    .slice(0, count);
}
