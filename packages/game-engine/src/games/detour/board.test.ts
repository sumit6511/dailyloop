import { describe, it, expect } from "vitest";
import { WallGrid, UNREACHABLE, type Cell } from "./board.js";

const sortCells = (cells: Cell[]) =>
  [...cells].sort((a, b) => a.row - b.row || a.col - b.col).map((c) => `${c.row},${c.col}`);

describe("WallGrid routes", () => {
  it("measures a straight run on an open board", () => {
    const grid = new WallGrid(7);
    expect(grid.distanceTo({ row: 6, col: 3 }, 0)).toBe(6);
    expect(grid.distanceMap(0)[6 * 7 + 3]).toBe(6);
  });

  it("blocks a vertical step with a horizontal wall, and a sideways step with a vertical one", () => {
    const grid = new WallGrid(7, [
      { orientation: "h", row: 4, col: 3 }, // between rows 4/5, cols 3-4
      { orientation: "v", row: 2, col: 0 }, // between cols 0/1, rows 2-3
    ]);
    expect(grid.isBlocked({ row: 5, col: 3 }, { row: 4, col: 3 })).toBe(true);
    expect(grid.isBlocked({ row: 5, col: 4 }, { row: 4, col: 4 })).toBe(true);
    expect(grid.isBlocked({ row: 5, col: 2 }, { row: 4, col: 2 })).toBe(false);
    expect(grid.isBlocked({ row: 3, col: 0 }, { row: 3, col: 1 })).toBe(true);
    expect(grid.isBlocked({ row: 4, col: 0 }, { row: 4, col: 1 })).toBe(false);
    // One sidestep around the end of the wall.
    expect(grid.distanceTo({ row: 6, col: 3 }, 0)).toBe(7);
  });

  it("returns a connected shortest path whose length matches the distance", () => {
    const grid = new WallGrid(7, [
      { orientation: "h", row: 2, col: 2 },
      { orientation: "h", row: 2, col: 4 },
    ]);
    const from = { row: 6, col: 3 };
    const path = grid.shortestPath(from, 0);
    expect(path[0]).toEqual(from);
    expect(path.at(-1)!.row).toBe(0);
    expect(path.length - 1).toBe(grid.distanceTo(from, 0));
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
      expect(grid.isBlocked(a, b)).toBe(false);
    }
  });
});

describe("WallGrid placement", () => {
  it("rejects overlapping and crossing walls but allows end-to-end ones", () => {
    const grid = new WallGrid(7, [{ orientation: "h", row: 3, col: 2 }]);
    expect(grid.fitsGeometrically({ orientation: "h", row: 3, col: 2 })).toBe(false); // same slot
    expect(grid.fitsGeometrically({ orientation: "h", row: 3, col: 1 })).toBe(false); // overlaps left half
    expect(grid.fitsGeometrically({ orientation: "h", row: 3, col: 3 })).toBe(false); // overlaps right half
    expect(grid.fitsGeometrically({ orientation: "v", row: 3, col: 2 })).toBe(false); // crosses the middle
    expect(grid.fitsGeometrically({ orientation: "h", row: 3, col: 4 })).toBe(true); // touches end to end
    expect(grid.fitsGeometrically({ orientation: "v", row: 3, col: 1 })).toBe(true); // meets at an end
    expect(grid.fitsGeometrically({ orientation: "h", row: 6, col: 0 })).toBe(false); // off the board
  });

  it("refuses a wall that would seal a pawn off from its goal", () => {
    // Box the bottom-left corner cell in on two sides already; the third closes it.
    const grid = new WallGrid(7, [
      { orientation: "h", row: 5, col: 0 }, // above (6,0) and (6,1)
    ]);
    const routes = [{ from: { row: 6, col: 0 }, goalRow: 0 }];
    expect(grid.tryWall({ orientation: "v", row: 5, col: 1 }, routes)).toBeNull();
    expect(grid.distanceTo({ row: 6, col: 0 }, 0)).not.toBe(UNREACHABLE); // the probe was undone
    expect(grid.tryWall({ orientation: "v", row: 4, col: 3 }, routes)).toEqual([8]);
  });
});

describe("WallGrid pawn moves", () => {
  it("steps orthogonally and never through walls or off the board", () => {
    const grid = new WallGrid(7, [{ orientation: "h", row: 5, col: 2 }]);
    expect(sortCells(grid.pawnMoves({ row: 6, col: 3 }, { row: 0, col: 3 }))).toEqual([
      "6,2",
      "6,4",
    ]);
  });

  it("jumps straight over an adjacent pawn", () => {
    const grid = new WallGrid(7);
    expect(sortCells(grid.pawnMoves({ row: 4, col: 3 }, { row: 3, col: 3 }))).toEqual([
      "2,3",
      "4,2",
      "4,4",
      "5,3",
    ]);
  });

  it("hops diagonally when a wall sits behind the other pawn", () => {
    const grid = new WallGrid(7, [{ orientation: "h", row: 2, col: 3 }]); // right behind (3,3)
    expect(sortCells(grid.pawnMoves({ row: 4, col: 3 }, { row: 3, col: 3 }))).toEqual([
      "3,2",
      "3,4",
      "4,2",
      "4,4",
      "5,3",
    ]);
  });

  it("hops diagonally when the board edge sits behind the other pawn", () => {
    const grid = new WallGrid(7);
    expect(sortCells(grid.pawnMoves({ row: 1, col: 3 }, { row: 0, col: 3 }))).toEqual([
      "0,2",
      "0,4",
      "1,2",
      "1,4",
      "2,3",
    ]);
  });

  it("never jumps across a wall between the two pawns", () => {
    const grid = new WallGrid(7, [{ orientation: "h", row: 3, col: 3 }]); // between (3,3) and (4,3)
    expect(sortCells(grid.pawnMoves({ row: 4, col: 3 }, { row: 3, col: 3 }))).toEqual([
      "4,2",
      "4,4",
      "5,3",
    ]);
  });
});
