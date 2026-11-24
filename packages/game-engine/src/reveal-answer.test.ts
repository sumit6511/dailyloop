import { describe, it, expect } from "vitest";
import { connectionsGame } from "./games/connections/index.js";
import { wordGuessGame } from "./games/word-guess/index.js";
import { numberPuzzleGame } from "./games/number-puzzle/index.js";
import { logicPuzzleGame } from "./games/logic-puzzle/index.js";
import { guessItGame } from "./games/guess-it/index.js";
import { pathwayGame } from "./games/pathway/index.js";
import { listGameModules, registerAllGames } from "./index.js";

const DATE = "2026-11-23";
const generate = <T>(module: { id: string; generatePuzzle(seed: string, dateKey: string): T }) =>
  module.generatePuzzle(`${module.id}-${DATE}`, DATE);

describe("revealAnswer", () => {
  it("is offered by every registered game", () => {
    registerAllGames();
    for (const module of listGameModules()) {
      expect(module.revealAnswer, module.id).toBeTypeOf("function");
    }
  });

  it("Connections: all four groups, easiest first", () => {
    const content = generate(connectionsGame);
    const reveal = connectionsGame.revealAnswer!(content);
    expect(reveal.kind).toBe("groups");
    if (reveal.kind !== "groups") return;
    expect(reveal.groups.map((g) => g.difficulty)).toEqual([1, 2, 3, 4]);
    expect(reveal.groups.flatMap((g) => g.words).sort()).toEqual([...content.words].sort());
  });

  it("Word Guess and Guess It: the answer", () => {
    const word = generate(wordGuessGame);
    expect(wordGuessGame.revealAnswer!(word)).toEqual({ kind: "word", answer: word.answer });
    const mystery = generate(guessItGame);
    expect(guessItGame.revealAnswer!(mystery)).toEqual({
      kind: "mystery",
      category: mystery.category,
      answer: mystery.answer,
    });
  });

  it("Number Puzzle: a working expression, even when none was stored", () => {
    const content = generate(numberPuzzleGame);
    const stored = numberPuzzleGame.revealAnswer!(content);
    expect(stored).toMatchObject({ kind: "equation", target: content.target });
    if (stored.kind === "equation") expect(stored.expression).toBe(content.solution);

    const adminEntered = { numbers: [2, 3, 4, 5, 6, 7], target: 26 };
    const derived = numberPuzzleGame.revealAnswer!(adminEntered);
    expect(derived.kind === "equation" && derived.expression).toBeTruthy();
  });

  it("Logic Puzzle: the solved grid, with the starting givens marked", () => {
    const content = generate(logicPuzzleGame);
    const reveal = logicPuzzleGame.revealAnswer!(content);
    expect(reveal.kind).toBe("grid");
    if (reveal.kind !== "grid") return;
    expect(reveal.rows).toEqual(content.solution);
    reveal.givens.forEach((row, r) =>
      row.forEach((given, c) => expect(given).toBe(content.puzzle[r]![c] !== 0)),
    );
  });

  it("Pathway: a path covering the whole board", () => {
    const content = generate(pathwayGame);
    const reveal = pathwayGame.revealAnswer!(content);
    expect(reveal.kind).toBe("path");
    if (reveal.kind !== "path") return;
    expect(reveal.path).toHaveLength(content.size * content.size);
    expect(reveal.checkpoints).toEqual(content.checkpoints);
  });
});
