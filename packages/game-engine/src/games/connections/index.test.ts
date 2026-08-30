import { describe, it, expect } from "vitest";
import { connectionsGame, type ConnectionsMove } from "./index.js";

const DATE = "2026-08-29";

function generate() {
  return connectionsGame.generatePuzzle("unused-seed", DATE);
}

describe("connections: generatePuzzle", () => {
  it("is deterministic for the same date", () => {
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

  it("differs across dates (rotates through the category bank)", () => {
    const day1 = connectionsGame.generatePuzzle("s", "2026-08-29");
    const day2 = connectionsGame.generatePuzzle("s", "2026-08-30");
    expect(day1.categories.map((c) => c.title)).not.toEqual(day2.categories.map((c) => c.title));
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

  it("ends the game (loss) once mistakes reach the limit without solving everything", () => {
    const moves: ConnectionsMove[] = [oneFromEachCategory, oneFromEachCategory, oneFromEachCategory, oneFromEachCategory];
    const result = connectionsGame.validateAttempt(content, moves);
    expect(result.mistakes).toBe(4);
    expect(result.won).toBe(false);
    expect(result.complete).toBe(true);
    expect(result.result.gaveUp).toBe(true);
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
