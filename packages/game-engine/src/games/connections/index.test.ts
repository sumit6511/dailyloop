import { describe, it, expect } from "vitest";
import { addDaysToKey } from "@dailyloop/shared";
import { connectionsGame, countGroupings, type ConnectionsMove } from "./index.js";
import { CATEGORY_BANK, type ConnectionsBankEntry } from "./categories.js";

const DATE = "2026-08-29";

function generate() {
  return connectionsGame.generatePuzzle("unused-seed", DATE);
}

describe("connections: generatePuzzle", () => {
  it("is deterministic for the same date and recentlyUsed", () => {
    expect(generate()).toEqual(generate());
  });

  it("produces 4 categories covering exactly the 16 shuffled words, with no duplicates", () => {
    const content = generate();
    expect(content.categories).toHaveLength(4);
    expect(content.words).toHaveLength(16);

    const fromCategories = content.categories.flatMap((c) => c.words);
    expect(new Set(fromCategories).size).toBe(16);
    expect(new Set(content.words)).toEqual(new Set(fromCategories));
  });

  it("prefers categories that haven't been used recently", () => {
    // One never-used category per tier (avoiding ones that share a word with each other), with
    // everything else marked as recently used — those four are the only fresh picks.
    const neverUsed = new Set(["Planets", "Cheeses", "Knots", "Palindromes"]);
    const recentlyUsed = CATEGORY_BANK.map((c) => c.title).filter((t) => !neverUsed.has(t));

    const content = connectionsGame.generatePuzzle("s", DATE, recentlyUsed);
    expect(new Set(content.categories.map((c) => c.title))).toEqual(neverUsed);
  });

  it("always has exactly one category of each difficulty, ordered yellow to purple", () => {
    for (let day = 0; day < 60; day++) {
      const content = connectionsGame.generatePuzzle("s", addDaysToKey(DATE, day));
      expect(content.categories.map((c) => c.difficulty)).toEqual([1, 2, 3, 4]);
    }
  });

  it("never builds a grid with a repeated word or more than one valid grouping", () => {
    let history: string[] = [];
    for (let day = 0; day < 365; day++) {
      const content = connectionsGame.generatePuzzle("s", addDaysToKey(DATE, day), history);
      history = [...history, ...connectionsGame.contentIdentity!(content)];
      expect(new Set(content.words).size).toBe(16);
      const entries = content.categories.map((c) => CATEGORY_BANK.find((b) => b.title === c.title)!);
      expect(countGroupings(entries)).toBe(1);
    }
  });

  it("doesn't repeat the same four-category grid within a year of rotation", () => {
    let history: string[] = [];
    const grids = new Set<string>();
    for (let day = 0; day < 365; day++) {
      const content = connectionsGame.generatePuzzle("s", addDaysToKey(DATE, day), history);
      history = [...history, ...connectionsGame.contentIdentity!(content)];
      grids.add(content.categories.map((c) => c.title).sort().join("|"));
    }
    expect(grids.size).toBe(365);
  });

  it("never stores generation-only bank metadata in puzzle content", () => {
    const content = generate();
    for (const category of content.categories) expect(Object.keys(category).sort()).toEqual(["difficulty", "title", "words"]);
  });
});

describe("connections: CATEGORY_BANK", () => {
  it("has unique titles, 4 distinct uppercase words per category, and plenty in every tier", () => {
    expect(new Set(CATEGORY_BANK.map((c) => c.title)).size).toBe(CATEGORY_BANK.length);
    for (const category of CATEGORY_BANK) {
      expect(new Set(category.words).size).toBe(4);
      for (const word of [...category.words, ...(category.herrings ?? [])]) expect(word).toMatch(/^[A-Z]+$/);
      // A pattern category must actually describe its own words.
      if (category.matches) for (const word of category.words) expect(category.matches(word)).toBe(true);
    }
    for (const tier of [1, 2, 3, 4]) {
      expect(CATEGORY_BANK.filter((c) => c.difficulty === tier).length).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("connections: countGroupings", () => {
  it("detects a grid where a red herring makes the grouping ambiguous", () => {
    const a: ConnectionsBankEntry = { title: "A", difficulty: 1, words: ["W", "X", "Y", "Z"], herrings: ["Q"] };
    const b: ConnectionsBankEntry = { title: "B", difficulty: 2, words: ["Q", "R", "S", "T"], herrings: ["Z"] };
    expect(countGroupings([a, b])).toBe(2); // Z and Q can swap
    expect(countGroupings([a, { ...b, herrings: [] }])).toBe(1); // B must take Q, so A takes Z
  });
});

describe("connections: contentIdentity", () => {
  it("returns the 4 category titles this content used", () => {
    const content = generate();
    expect(connectionsGame.contentIdentity!(content)).toEqual(content.categories.map((c) => c.title));
  });
});

describe("connections: validateAttempt", () => {
  const content = generate();
  const [catA, catB, catC, catD] = content.categories;

  it("marks a correct group solved regardless of guess order, and is complete only once all 4 are solved", () => {
    const moves: ConnectionsMove[] = [
      { words: [...catA!.words].reverse() },
      { words: catB!.words },
      { words: catC!.words },
    ];
    const partial = connectionsGame.validateAttempt(content, moves);
    expect(partial.complete).toBe(false);
    expect(partial.result.solved).toHaveLength(3);
    expect(partial.mistakes).toBe(0);

    const finished = connectionsGame.validateAttempt(content, [...moves, { words: catD!.words }]);
    expect(finished.complete).toBe(true);
    expect(finished.won).toBe(true);
    expect(finished.mistakes).toBe(0);
  });

  // One word from each of the 4 real categories can never itself equal a full category
  // (a category needs all 4 of its own words), so this is guaranteed to be a wrong guess.
  const oneFromEachCategory = { words: [catA!.words[0], catB!.words[0], catC!.words[0], catD!.words[0]] };

  it("counts a non-matching guess as a mistake without solving anything", () => {
    const result = connectionsGame.validateAttempt(content, [oneFromEachCategory]);
    expect(result.mistakes).toBe(1);
    expect(result.result.solved).toHaveLength(0);
    expect(result.complete).toBe(false);
  });

  // Four different wrong guesses: the k-th word of every category.
  const wrongGuesses: ConnectionsMove[] = [0, 1, 2, 3].map((k) => ({
    words: [catA!.words[k]!, catB!.words[k]!, catC!.words[k]!, catD!.words[k]!],
  }));

  it("ends the game (loss) once mistakes reach the limit without solving everything", () => {
    const result = connectionsGame.validateAttempt(content, wrongGuesses);
    expect(result.mistakes).toBe(4);
    expect(result.won).toBe(false);
    expect(result.complete).toBe(true);
    expect(result.result.gaveUp).toBe(true);
  });

  it("ignores a repeated wrong guess (any order or case) instead of charging another mistake", () => {
    const reordered = { words: [...oneFromEachCategory.words].reverse().map((w) => w.toLowerCase()) };
    const result = connectionsGame.validateAttempt(content, [oneFromEachCategory, reordered]);
    expect(result.mistakes).toBe(1);
    expect(result.result.guesses).toHaveLength(1);
    expect(result.result.lastMoveRepeated).toBe(true);
  });

  it("doesn't count double-submitting a group that was just solved as a mistake", () => {
    const result = connectionsGame.validateAttempt(content, [{ words: catA!.words }, { words: catA!.words }]);
    expect(result.mistakes).toBe(0);
    expect(result.result.solved).toHaveLength(1);
  });

  it("flags a wrong guess as one away when three of its words share an unsolved category", () => {
    const threeAndOne = { words: [catA!.words[0], catA!.words[1], catA!.words[2], catB!.words[0]] };
    const result = connectionsGame.validateAttempt(content, [threeAndOne, oneFromEachCategory]);
    expect(result.result.guesses.map((g) => g.oneAway)).toEqual([true, false]);
    expect(result.result.lastMoveRepeated).toBe(false);
  });
});

describe("connections: calculateScore", () => {
  const content = generate();
  const [catA, catB, catC, catD] = content.categories;
  const oneFromEachCategory = { words: [catA!.words[0], catB!.words[0], catC!.words[0], catD!.words[0]] };
  const won = connectionsGame.validateAttempt(content, content.categories.map((c) => ({ words: c.words })));

  it("scores a flawless fast solve at the maximum", () => {
    const score = connectionsGame.calculateScore(content, won.result, { durationMs: 5_000 });
    expect(score.total).toBe(100);
  });

  it("penalizes mistakes", () => {
    const withMistake = connectionsGame.validateAttempt(content, [
      oneFromEachCategory,
      ...content.categories.map((c) => ({ words: c.words })),
    ]);
    const score = connectionsGame.calculateScore(content, withMistake.result, { durationMs: 5_000 });
    expect(score.total).toBeLessThan(100);
  });

  it("gives partial credit for a loss based on groups solved", () => {
    const lost = connectionsGame.validateAttempt(content, [
      { words: catA!.words },
      oneFromEachCategory,
      oneFromEachCategory,
      oneFromEachCategory,
      oneFromEachCategory,
    ]);
    expect(lost.won).toBe(false);
    const score = connectionsGame.calculateScore(content, lost.result, { durationMs: 60_000 });
    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThan(60);
  });
});

describe("connections: sanitizeForClient", () => {
  const content = generate();

  it("never reveals category groupings before the player has started", () => {
    const view = connectionsGame.sanitizeForClient(content, null) as { words: string[]; categories?: unknown };
    expect(view.words).toHaveLength(16);
    expect(view.categories).toBeUndefined();
  });

  it("reveals only solved groups while in progress", () => {
    const moves: ConnectionsMove[] = [{ words: content.categories[0]!.words }];
    const view = connectionsGame.sanitizeForClient(content, { status: "IN_PROGRESS", moves }) as {
      solved: unknown[];
      categories?: unknown;
    };
    expect(view.solved).toHaveLength(1);
    expect(view.categories).toBeUndefined();
  });

  it("reveals the full answer key once the attempt is completed", () => {
    const moves: ConnectionsMove[] = content.categories.map((c) => ({ words: c.words }));
    const view = connectionsGame.sanitizeForClient(content, { status: "COMPLETED", moves }) as {
      categories?: unknown;
    };
    expect(view.categories).toBeDefined();
  });
});
