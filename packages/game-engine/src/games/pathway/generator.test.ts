import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import {
  buildHamiltonianPath,
  edgeKey,
  generatePathwayPuzzle,
  solvePathway,
  type Cell,
} from "./generator.js";

function isValidHamiltonianPath(path: Cell[], size: number): boolean {
  if (path.length !== size * size) return false;
  const seen = new Set<string>();
  for (const cell of path) {
    if (cell.row < 0 || cell.row >= size || cell.col < 0 || cell.col >= size) return false;
    const key = `${cell.row}-${cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  if (seen.size !== size * size) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const distance = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    if (distance !== 1) return false;
  }
  return true;
}

const OPTIONS = { size: 5, checkpointCount: 6 };

describe("generatePathwayPuzzle", () => {
  it("produces a valid Hamiltonian path covering every cell exactly once", () => {
    const puzzle = generatePathwayPuzzle(createRng("pathway-seed"), OPTIONS);
    expect(isValidHamiltonianPath(puzzle.solution, 5)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = generatePathwayPuzzle(createRng("same-seed"), OPTIONS);
    const b = generatePathwayPuzzle(createRng("same-seed"), OPTIONS);
    expect(a).toEqual(b);
  });

  it("places checkpoint 1 at the path's start and the last checkpoint at its end", () => {
    const puzzle = generatePathwayPuzzle(createRng("checkpoint-seed"), OPTIONS);
    expect(puzzle.checkpoints[0]).toEqual(puzzle.solution[0]);
    expect(puzzle.checkpoints.at(-1)).toEqual(puzzle.solution.at(-1));
    expect(puzzle.checkpoints).toHaveLength(OPTIONS.checkpointCount);
  });

  it("orders checkpoints in strictly increasing position along the solution path", () => {
    const puzzle = generatePathwayPuzzle(createRng("order-seed"), OPTIONS);
    const indices = puzzle.checkpoints.map((cp) =>
      puzzle.solution.findIndex((cell) => cell.row === cp.row && cell.col === cp.col),
    );
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it("never places a wall on an edge the solution path actually uses", () => {
    const puzzle = generatePathwayPuzzle(createRng("wall-seed"), OPTIONS);
    const solutionEdges = new Set<string>();
    for (let i = 0; i < puzzle.solution.length - 1; i++) {
      solutionEdges.add(edgeKey(puzzle.solution[i]!, puzzle.solution[i + 1]!));
    }
    for (const wall of puzzle.walls) {
      expect(solutionEdges.has(edgeKey(wall.a, wall.b))).toBe(false);
    }
  });

  it.each([5, 6, 7])(
    "always has exactly one solution — the stored one — on a %dx%d board",
    (size) => {
      for (const seed of ["u1", "u2", "u3", "u4"]) {
        const puzzle = generatePathwayPuzzle(createRng(`${seed}-${size}`), {
          size,
          checkpointCount: 6,
        });
        const solutions = solvePathway(puzzle, 2);
        expect(solutions).toHaveLength(1);
        expect(solutions[0]).toEqual(puzzle.solution);
      }
    },
  );

  it("keeps only walls that are actually needed for uniqueness", () => {
    const puzzle = generatePathwayPuzzle(createRng("minimal-walls"), {
      size: 6,
      checkpointCount: 5,
    });
    for (const wall of puzzle.walls) {
      const without = puzzle.walls.filter((w) => w !== wall);
      expect(solvePathway({ ...puzzle, walls: without }, 2).length).toBeGreaterThan(1);
    }
  });

  it("places exactly `wallCount` random walls when uniqueness isn't requested", () => {
    const puzzle = generatePathwayPuzzle(createRng("random-walls"), {
      size: 5,
      checkpointCount: 5,
      unique: false,
      wallCount: 6,
    });
    expect(puzzle.walls).toHaveLength(6);
  });
});

describe("buildHamiltonianPath", () => {
  it.each([4, 5, 6, 7])("never fails, whatever the grid parity (%dx%d)", (size) => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      expect(isValidHamiltonianPath(buildHamiltonianPath(createRng(seed), size), size)).toBe(true);
    }
  });

  it("doesn't just return the starting snake pattern", () => {
    const shapes = new Set(
      ["a", "b", "c", "d", "e"].map((seed) =>
        JSON.stringify(buildHamiltonianPath(createRng(seed), 6)),
      ),
    );
    expect(shapes.size).toBe(5);
  });
});

describe("solvePathway", () => {
  it("finds every solution of a tiny unconstrained board up to the limit", () => {
    // 2x2 starting top-left and ending bottom-left: only the clockwise loop works.
    const solutions = solvePathway(
      {
        size: 2,
        checkpoints: [
          { row: 0, col: 0 },
          { row: 1, col: 0 },
        ],
        walls: [],
      },
      5,
    );
    expect(solutions).toEqual([
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 0 },
      ],
    ]);
  });

  it("respects walls", () => {
    const walls = [{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }];
    expect(
      solvePathway(
        {
          size: 2,
          checkpoints: [
            { row: 0, col: 0 },
            { row: 1, col: 0 },
          ],
          walls,
        },
        5,
      ),
    ).toEqual([]);
  });
});
