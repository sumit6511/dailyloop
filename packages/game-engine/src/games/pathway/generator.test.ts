import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import { edgeKey, generatePathwayPuzzle, type Cell } from "./generator.js";

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

describe("generatePathwayPuzzle", () => {
  it("produces a valid Hamiltonian path covering every cell exactly once", () => {
    const puzzle = generatePathwayPuzzle(createRng("pathway-seed"), 5, 5, 6);
    expect(isValidHamiltonianPath(puzzle.solution, 5)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = generatePathwayPuzzle(createRng("same-seed"), 5, 5, 6);
    const b = generatePathwayPuzzle(createRng("same-seed"), 5, 5, 6);
    expect(a).toEqual(b);
  });

  it("places checkpoint 1 at the path's start and the last checkpoint at its end", () => {
    const puzzle = generatePathwayPuzzle(createRng("checkpoint-seed"), 5, 5, 6);
    expect(puzzle.checkpoints[0]).toEqual(puzzle.solution[0]);
    expect(puzzle.checkpoints.at(-1)).toEqual(puzzle.solution.at(-1));
    expect(puzzle.checkpoints).toHaveLength(5);
  });

  it("orders checkpoints in strictly increasing position along the solution path", () => {
    const puzzle = generatePathwayPuzzle(createRng("order-seed"), 5, 5, 6);
    const indices = puzzle.checkpoints.map((cp) =>
      puzzle.solution.findIndex((cell) => cell.row === cp.row && cell.col === cp.col),
    );
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it("never places a wall on an edge the solution path actually uses", () => {
    const puzzle = generatePathwayPuzzle(createRng("wall-seed"), 5, 5, 6);
    const solutionEdges = new Set<string>();
    for (let i = 0; i < puzzle.solution.length - 1; i++) {
      solutionEdges.add(edgeKey(puzzle.solution[i]!, puzzle.solution[i + 1]!));
    }
    for (const wall of puzzle.walls) {
      expect(solutionEdges.has(edgeKey(wall.a, wall.b))).toBe(false);
    }
    expect(puzzle.walls.length).toBeLessThanOrEqual(6);
  });
});
