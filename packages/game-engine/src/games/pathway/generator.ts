import { pickN, randInt, shuffle } from "../../rng.js";

export interface Cell {
  row: number;
  col: number;
}

export interface Wall {
  a: Cell;
  b: Cell;
}

export interface PathwayPuzzle {
  size: number;
  /** Checkpoint N is `checkpoints[N-1]` — position in the array *is* its number, checkpoints[0]
   * must be the path's start and the last entry must be the path's end. */
  checkpoints: Cell[];
  walls: Wall[];
  /** Server-only, never sent to the client — a valid solve, not necessarily the only one. */
  solution: Cell[];
}

/** Per-attempt backtracking budget — bounds a single `buildHamiltonianPath` call so a run of
 * bad luck can't hang; the caller retries from a fresh random start instead. */
const MAX_BACKTRACK_STEPS = 20_000;

function cellKey(cell: Cell): string {
  return `${cell.row}-${cell.col}`;
}

export function edgeKey(a: Cell, b: Cell): string {
  const [first, second] = cellKey(a) < cellKey(b) ? [a, b] : [b, a];
  return `${cellKey(first)}|${cellKey(second)}`;
}

function neighborsOf(cell: Cell, size: number): Cell[] {
  const candidates = [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];
  return candidates.filter((c) => c.row >= 0 && c.row < size && c.col >= 0 && c.col < size);
}

/** Randomized DFS with backtracking — grid graphs have plentiful Hamiltonian paths, so this
 * finds one quickly in practice; `MAX_BACKTRACK_STEPS` just guarantees a single attempt can
 * never hang if a particular random start/ordering happens to explore a bad branch. */
function buildHamiltonianPath(rng: () => number, size: number): Cell[] | null {
  const total = size * size;
  const path: Cell[] = [];
  const visited = new Set<string>();
  let steps = 0;

  function walk(cell: Cell): boolean {
    steps++;
    if (steps > MAX_BACKTRACK_STEPS) return false;
    path.push(cell);
    visited.add(cellKey(cell));
    if (path.length === total) return true;
    for (const next of shuffle(rng, neighborsOf(cell, size))) {
      if (!visited.has(cellKey(next)) && walk(next)) return true;
    }
    path.pop();
    visited.delete(cellKey(cell));
    return false;
  }

  const start = { row: randInt(rng, 0, size - 1), col: randInt(rng, 0, size - 1) };
  return walk(start) ? path : null;
}

/** Evenly spaced indices along the path, always including the first and last cell — checkpoint
 * 1 must be the path's start and the highest checkpoint must be its end, matching how Zip-style
 * puzzles work. */
function pickCheckpointIndices(pathLength: number, count: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round((i * (pathLength - 1)) / (count - 1)));
  }
  return [...new Set(indices)];
}

/** Walls only ever go on grid-adjacent cell pairs that the solution path does NOT step between
 * — so placing them can never make the generated solution invalid. */
function candidateWallEdges(size: number, solutionEdges: Set<string>): Wall[] {
  const edges: Wall[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };
      if (col + 1 < size && !solutionEdges.has(edgeKey({ row, col }, right))) {
        edges.push({ a: { row, col }, b: right });
      }
      if (row + 1 < size && !solutionEdges.has(edgeKey({ row, col }, down))) {
        edges.push({ a: { row, col }, b: down });
      }
    }
  }
  return edges;
}

export function generatePathwayPuzzle(
  rng: () => number,
  size: number,
  checkpointCount: number,
  wallCount: number,
  maxAttempts = 50,
): PathwayPuzzle {
  let solution: Cell[] | null = null;
  for (let attempt = 0; attempt < maxAttempts && !solution; attempt++) {
    solution = buildHamiltonianPath(rng, size);
  }
  if (!solution) {
    throw new Error(`Failed to generate a Hamiltonian path for a ${size}x${size} grid after ${maxAttempts} attempts`);
  }

  const checkpointIndices = pickCheckpointIndices(solution.length, checkpointCount);
  const checkpoints: Cell[] = checkpointIndices.map((index) => solution![index]!);

  const solutionEdges = new Set<string>();
  for (let i = 0; i < solution.length - 1; i++) {
    solutionEdges.add(edgeKey(solution[i]!, solution[i + 1]!));
  }
  const walls = pickN(rng, candidateWallEdges(size, solutionEdges), wallCount);

  return { size, checkpoints, walls, solution };
}
