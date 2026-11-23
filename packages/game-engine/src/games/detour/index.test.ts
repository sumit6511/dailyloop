import { describe, it, expect } from "vitest";
import { speedBonus } from "../../scoring.js";
import { WallGrid, wallKey, type Cell, type Wall } from "./board.js";
import { chooseAction } from "./bot.js";
import { applyAction, createState, isLegalAction, type DetourAction } from "./game.js";
import { generateStones, rotateWall } from "./generator.js";
import { createRng } from "../../rng.js";
import { detourGame, type DetourContent, type DetourMove } from "./index.js";

const OPEN_BOARD: DetourContent = { size: 7, wallsEach: 6, stones: [], botSeed: 1 };
/**
 * No walls for anyone, on an even-height board: both pawns walk the middle file, and the timing
 * works out so it's the player who gets to jump the bot (on 7 rows the bot gets the jump).
 */
const NO_WALLS: DetourContent = { size: 6, wallsEach: 0, stones: [], botSeed: 1 };

const up = (row: number, col = 3): DetourMove => ({ type: "step", row, col });
// (5,3)->(4,3)->(3,3), the bot steps to (2,3) right in front, the player jumps it to (1,3), then home.
const raceToWin = [up(4), up(3), up(1), up(0)];

describe("generatePuzzle", () => {
  it("is deterministic for the same dateKey and valid against its own schema", () => {
    const a = detourGame.generatePuzzle("ignored", "2026-11-23");
    const b = detourGame.generatePuzzle("other", "2026-11-23");
    expect(a).toEqual(b);
    expect(detourGame.contentSchema.safeParse(a).success).toBe(true);
  });

  it("varies the layout from day to day", () => {
    const layouts = new Set(
      ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"].map((d) =>
        JSON.stringify(detourGame.generatePuzzle("s", d).stones),
      ),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("places stones in mirror-image pairs that never overlap and never seal anyone in", () => {
    for (let day = 1; day <= 28; day++) {
      const content = detourGame.generatePuzzle("s", `2026-02-${String(day).padStart(2, "0")}`);
      const keys = new Set(content.stones.map(wallKey));
      expect(keys.size).toBe(content.stones.length);
      for (const stone of content.stones)
        expect(keys.has(wallKey(rotateWall(stone, content.size)))).toBe(true);

      // Rebuilding stone by stone proves no pair overlaps or crosses another.
      const grid = new WallGrid(content.size);
      for (const stone of content.stones) {
        expect(grid.fitsGeometrically(stone)).toBe(true);
        grid.place(stone);
      }
      const playerRoute = grid.distanceTo({ row: 6, col: 3 }, 0);
      expect(playerRoute).toBe(grid.distanceTo({ row: 0, col: 3 }, 6)); // symmetric = fair
      expect(playerRoute).toBeLessThanOrEqual(8);
    }
  });

  it("generateStones honours the requested pair count when there's room", () => {
    expect(generateStones(createRng("x"), 7, 2)).toHaveLength(4);
  });
});

describe("validateAttempt", () => {
  it("wins a pure race by jumping the bot", () => {
    const v = detourGame.validateAttempt(NO_WALLS, raceToWin);
    expect(v).toMatchObject({ won: true, complete: true, mistakes: 0 });
    expect(v.result).toMatchObject({
      winner: "player",
      turns: 4,
      wallsUsed: 0,
      playerDistance: 0,
      botDistance: 2,
    });
  });

  it("loses to the bot when the player only walks and never walls", () => {
    // The bot walls whenever it's behind, so a player who never answers is out-raced.
    const moves: DetourMove[] = [];
    let v = detourGame.validateAttempt(OPEN_BOARD, moves);
    for (let i = 0; i < 40 && !v.complete; i++) {
      const view = detourGame.sanitizeForClient(OPEN_BOARD, { status: "IN_PROGRESS", moves }) as {
        walls: Wall[];
        legalSteps: Cell[];
      };
      const grid = new WallGrid(7, view.walls);
      const next = [...view.legalSteps].sort(
        (a, b) => grid.distanceTo(a, 0) - grid.distanceTo(b, 0),
      )[0]!;
      moves.push({ type: "step", row: next.row, col: next.col });
      v = detourGame.validateAttempt(OPEN_BOARD, moves);
    }
    expect(v).toMatchObject({ won: false, complete: true });
    expect(v.result.winner).toBe("bot");
  });

  it("ignores illegal moves without penalty and without a bot reply", () => {
    const illegal: DetourMove[] = [
      { type: "step", row: 4, col: 3 }, // two squares away
      { type: "step", row: 6, col: 3 }, // not a move at all
      { type: "wall", orientation: "h", row: 6, col: 0 }, // off the board
    ];
    const v = detourGame.validateAttempt(OPEN_BOARD, illegal);
    expect(v).toMatchObject({ complete: false, mistakes: 0 });
    expect(v.result.turns).toBe(0);
  });

  it("rejects a wall that overlaps a stone", () => {
    const content: DetourContent = {
      ...OPEN_BOARD,
      stones: [{ orientation: "h", row: 2, col: 2 }],
    };
    const v = detourGame.validateAttempt(content, [
      { type: "wall", orientation: "h", row: 2, col: 3 },
    ]);
    expect(v.result.turns).toBe(0);
  });

  it("stops counting once the game is over", () => {
    const v = detourGame.validateAttempt(NO_WALLS, [...raceToWin, up(1)]);
    expect(v.result.turns).toBe(4);
  });

  it("ends the game on resign as a loss", () => {
    const v = detourGame.validateAttempt(OPEN_BOARD, [up(5), { type: "resign" }, up(4)]);
    expect(v).toMatchObject({ won: false, complete: true });
    expect(v.result).toMatchObject({ resigned: true, winner: "bot", turns: 2 });
  });
});

describe("bot", () => {
  it("takes the win when it's one step away", () => {
    const state = createState({ size: 7, wallsEach: 6, stones: [] });
    state.pawns.bot = { row: 5, col: 0 };
    expect(chooseAction(state, "bot", 1, 0)).toEqual({ type: "step", row: 6, col: 0 });
  });

  it("walls a player who is about to win when walking can't save it", () => {
    const state = createState({ size: 7, wallsEach: 6, stones: [] });
    state.pawns.player = { row: 1, col: 5 };
    const action = chooseAction(state, "bot", 1, 0);
    expect(action.type).toBe("wall");
  });

  it("always picks a legal action and is deterministic across whole games", () => {
    for (let day = 0; day < 6; day++) {
      const content = detourGame.generatePuzzle("s", `2026-03-0${day + 1}`);
      const state = createState(content);
      const replayState = createState(content);
      for (let turn = 0; turn < 60 && !state.winner; turn++) {
        const side = turn % 2 === 0 ? "player" : "bot";
        const action: DetourAction = chooseAction(state, side, content.botSeed, turn);
        expect(isLegalAction(state, side, action)).toBe(true);
        expect(chooseAction(replayState, side, content.botSeed, turn)).toEqual(action);
        applyAction(state, side, action);
        applyAction(replayState, side, action);
      }
      expect(state.winner).not.toBeNull();
    }
  });
});

describe("calculateScore", () => {
  it("rewards the winning margin and speed", () => {
    const { result } = detourGame.validateAttempt(NO_WALLS, raceToWin);
    const score = detourGame.calculateScore(NO_WALLS, result, { durationMs: 30_000 });
    expect(score).toMatchObject({ base: 60, accuracyBonus: 12, speedBonus: 10, total: 82 });
    const slow = detourGame.calculateScore(NO_WALLS, result, { durationMs: 200_000 });
    expect(slow.speedBonus).toBe(speedBonus(200_000, 60_000, 360_000, 10));
  });

  it("gives a close loss a little, and a resignation nothing", () => {
    const base = { won: false, winner: "bot" as const, turns: 10, wallsUsed: 6, botDistance: 0 };
    expect(
      detourGame.calculateScore(
        OPEN_BOARD,
        { ...base, resigned: false, playerDistance: 1 },
        { durationMs: 1 },
      ).total,
    ).toBe(20);
    expect(
      detourGame.calculateScore(
        OPEN_BOARD,
        { ...base, resigned: false, playerDistance: 6 },
        { durationMs: 1 },
      ).total,
    ).toBe(0);
    expect(
      detourGame.calculateScore(
        OPEN_BOARD,
        { ...base, resigned: true, playerDistance: 1 },
        { durationMs: 1 },
      ).total,
    ).toBe(0);
  });
});

describe("sanitizeForClient", () => {
  it("shows the opening position with every legal move and no bot seed", () => {
    const view = detourGame.sanitizeForClient(OPEN_BOARD, null) as Record<string, unknown>;
    expect(view).toMatchObject({
      size: 7,
      player: { row: 6, col: 3 },
      bot: { row: 0, col: 3 },
      wallsLeft: { player: 6, bot: 6 },
      turns: 0,
      complete: false,
    });
    expect(view.legalSteps).toHaveLength(3);
    expect(view.legalWalls).toHaveLength(72);
    expect(view).not.toHaveProperty("botSeed");
  });

  it("reports the bot's reply to the last move", () => {
    const view = detourGame.sanitizeForClient(OPEN_BOARD, {
      status: "IN_PROGRESS",
      moves: [up(5)],
    }) as {
      lastTurn: { player: DetourMove; bot: DetourAction };
    };
    expect(view.lastTurn.player).toEqual(up(5));
    expect(view.lastTurn.bot).not.toBeNull();
  });

  it("offers nothing to play and reveals the result once complete", () => {
    const view = detourGame.sanitizeForClient(NO_WALLS, {
      status: "COMPLETED",
      moves: raceToWin,
    }) as Record<string, unknown>;
    expect(view).toMatchObject({
      complete: true,
      won: true,
      botDistance: 2,
      legalSteps: [],
      legalWalls: [],
    });
  });
});
