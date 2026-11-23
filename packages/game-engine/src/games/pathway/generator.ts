import { randInt, shuffle } from "../../rng.js";

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
  /** Server-only, never sent to the client — the puzzle's (unique) solution. */
  solution: Cell[];
}

/** Just the constraints a player sees — everything a solver needs. */
export type PathwayConstraints = Pick<PathwayPuzzle, "size" | "checkpoints" | "walls">;

export interface PathwayOptions {
  size: number;
  checkpointCount: number;
  /**
   * When true (the default), walls are added on edges the solution doesn't use until no other
   * path satisfies the constraints, then any wall that isn't needed for that is removed again —
   * so the puzzle has exactly one solution with as few walls as possible.
   */
  unique?: boolean;
  /** Only used when `unique` is false: how many random non-solution walls to place. */
  wallCount?: number;
}

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

// --- Path generation --------------------------------------------------------------------------

/** A boustrophedon ("snake") path — a trivially valid Hamiltonian path to start mixing from. */
function serpentine(size: number): Cell[] {
  const path: Cell[] = [];
  for (let row = 0; row < size; row++) {
    for (let i = 0; i < size; i++) path.push({ row, col: row % 2 === 0 ? i : size - 1 - i });
  }
  return path;
}

/**
 * Random Hamiltonian path via the "backbite" Markov chain: repeatedly pick an end of the path,
 * step it to a random grid neighbour already on the path, and reverse the segment that closes
 * into a loop. Every step keeps the path Hamiltonian, so — unlike randomised DFS — it can never
 * fail or hang, never cares about grid-colouring parity, and mixes into far less "snaky",
 * more varied shapes than DFS's characteristic long sweeps.
 */
export function buildHamiltonianPath(rng: () => number, size: number): Cell[] {
  let path = serpentine(size);
  if (rng() < 0.5) path = path.map(({ row, col }) => ({ row: col, col: row })); // transpose
  const total = size * size;
  const indexOf = new Map<string, number>();
  const reindex = () => path.forEach((cell, i) => indexOf.set(cellKey(cell), i));
  reindex();

  const iterations = total * 40;
  for (let step = 0; step < iterations; step++) {
    const fromEnd = rng() < 0.5;
    const end = fromEnd ? path[total - 1]! : path[0]!;
    const adjacentOnPath = fromEnd ? path[total - 2]! : path[1]!;
    const options = neighborsOf(end, size).filter((n) => cellKey(n) !== cellKey(adjacentOnPath));
    if (options.length === 0) continue;
    const target = options[randInt(rng, 0, options.length - 1)]!;
    const k = indexOf.get(cellKey(target))!;
    if (fromEnd) {
      // path[0..k] stays; path[k+1..end] is reversed so `end` now sits next to `target`.
      path = [...path.slice(0, k + 1), ...path.slice(k + 1).reverse()];
    } else {
      path = [...path.slice(0, k).reverse(), ...path.slice(k)];
    }
    reindex();
  }
  return path;
}

/**
 * Checkpoint positions along the path: always the first and last cell, with the interior ones
 * spread out (one per equal-length stretch of the path, jittered within it) so numbers never
 * cluster together or sit right next to each other along the route.
 */
function pickCheckpointIndices(rng: () => number, pathLength: number, count: number): number[] {
  const indices = [0];
  const interior = count - 2;
  const stretch = (pathLength - 1) / (interior + 1);
  for (let i = 1; i <= interior; i++) {
    const center = i * stretch;
    const jitter = Math.max(0, Math.floor(stretch / 2) - 1);
    const index = Math.round(center) + randInt(rng, -jitter, jitter);
    indices.push(Math.min(pathLength - 2, Math.max(indices[indices.length - 1]! + 2, index)));
  }
  indices.push(pathLength - 1);
  return [...new Set(indices)];
}

// --- Solver -----------------------------------------------------------------------------------

/**
 * Enumerates paths that satisfy the constraints (start on 1, visit every cell exactly once,
 * touch checkpoints in order, end on the last one, never cross a wall), stopping after `limit`.
 * Pruned by connectivity and dead-end checks, so even a 7×7 board with sparse clues resolves in
 * milliseconds.
 */
export function solvePathway(constraints: PathwayConstraints, limit = 2): Cell[][] {
  const { size, checkpoints, walls } = constraints;
  const total = size * size;
  if (checkpoints.length === 0) return [];
  const idx = (c: Cell) => c.row * size + c.col;
  const wallSet = new Set(walls.map((w) => edgeKey(w.a, w.b)));
  const adjacency: number[][] = Array.from({ length: total }, (_, i) => {
    const cell = { row: Math.floor(i / size), col: i % size };
    return neighborsOf(cell, size)
      .filter((n) => !wallSet.has(edgeKey(cell, n)))
      .map(idx);
  });
  const checkpointAt = new Int32Array(total);
  checkpoints.forEach((cp, i) => (checkpointAt[idx(cp)] = i + 1));
  const last = checkpoints.length;
  const endIndex = idx(checkpoints[last - 1]!);

  const visited = new Uint8Array(total);
  const path: number[] = [];
  const solutions: Cell[][] = [];
  const queue = new Int32Array(total);
  const seen = new Uint8Array(total);

  /** Every unvisited cell must still be reachable from the head, and every unvisited cell other
   * than the fixed end needs two open sides (one way in, one way out). */
  function viable(head: number): boolean {
    seen.fill(0);
    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = head;
    seen[head] = 1;
    let reached = 0;
    while (qHead < qTail) {
      const cur = queue[qHead++]!;
      for (const n of adjacency[cur]!) {
        if (visited[n] || seen[n]) continue;
        seen[n] = 1;
        reached++;
        queue[qTail++] = n;
      }
    }
    if (reached !== total - path.length) return false;

    for (let i = 0; i < total; i++) {
      if (visited[i]) continue;
      let open = 0;
      for (const n of adjacency[i]!) if (!visited[n] || n === head) open++;
      if (open < (i === endIndex ? 1 : 2)) return false;
    }
    return true;
  }

  function walk(cur: number, nextCheckpoint: number): boolean {
    if (path.length === total) {
      solutions.push(path.map((i) => ({ row: Math.floor(i / size), col: i % size })));
      return solutions.length >= limit;
    }
    for (const n of adjacency[cur]!) {
      if (visited[n]) continue;
      const cp = checkpointAt[n]!;
      if (cp !== 0 && cp !== nextCheckpoint) continue;
      if (cp === last && path.length + 1 !== total) continue;
      visited[n] = 1;
      path.push(n);
      if ((path.length === total || viable(n)) && walk(n, cp !== 0 ? nextCheckpoint + 1 : nextCheckpoint)) return true;
      path.pop();
      visited[n] = 0;
    }
    return false;
  }

  const start = idx(checkpoints[0]!);
  visited[start] = 1;
  path.push(start);
  if (total === 1) solutions.push([checkpoints[0]!]);
  else walk(start, 2);
  return solutions;
}

// --- Puzzle generation ------------------------------------------------------------------------

function solutionEdgeSet(solution: Cell[]): Set<string> {
  const edges = new Set<string>();
  for (let i = 0; i < solution.length - 1; i++) edges.add(edgeKey(solution[i]!, solution[i + 1]!));
  return edges;
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

/** Adds walls until the intended solution is the only one. Any other valid path must use at
 * least one edge the intended path doesn't (a Hamiltonian path with a fixed start is determined
 * by its edges), so walling one of those off always rules that alternative out — this loop
 * always terminates with a unique puzzle. */
function addWallsUntilUnique(rng: () => number, constraints: PathwayConstraints, solutionEdges: Set<string>): Wall[] {
  const walls = [...constraints.walls];
  const wallKeys = new Set(walls.map((w) => edgeKey(w.a, w.b)));
  for (;;) {
    const alternative = solvePathway({ ...constraints, walls }, 2).find((path) => edgeKeyList(path).some((k) => !solutionEdges.has(k)));
    if (!alternative) return walls;
    const divergent: Wall[] = [];
    for (let i = 0; i < alternative.length - 1; i++) {
      const a = alternative[i]!;
      const b = alternative[i + 1]!;
      const key = edgeKey(a, b);
      if (!solutionEdges.has(key) && !wallKeys.has(key)) divergent.push({ a, b });
    }
    // Prefer the first few divergent edges — cutting where the alternative first leaves the
    // intended route tends to eliminate whole families of alternatives at once.
    const wall = divergent[randInt(rng, 0, Math.min(2, divergent.length - 1))]!;
    walls.push(wall);
    wallKeys.add(edgeKey(wall.a, wall.b));
  }
}

function edgeKeyList(path: Cell[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < path.length - 1; i++) keys.push(edgeKey(path[i]!, path[i + 1]!));
  return keys;
}

/** Drops every wall that isn't actually needed for uniqueness (tried in random order). */
function pruneRedundantWalls(rng: () => number, constraints: PathwayConstraints): Wall[] {
  let walls = [...constraints.walls];
  for (const wall of shuffle(rng, walls)) {
    const without = walls.filter((w) => w !== wall);
    if (solvePathway({ ...constraints, walls: without }, 2).length === 1) walls = without;
  }
  return walls;
}

export function generatePathwayPuzzle(rng: () => number, options: PathwayOptions): PathwayPuzzle {
  const { size, checkpointCount, unique = true, wallCount = 0 } = options;
  const solution = buildHamiltonianPath(rng, size);
  const checkpoints = pickCheckpointIndices(rng, solution.length, Math.max(2, checkpointCount)).map((i) => solution[i]!);
  const solutionEdges = solutionEdgeSet(solution);

  if (!unique) {
    const walls = shuffle(rng, candidateWallEdges(size, solutionEdges)).slice(0, wallCount);
    return { size, checkpoints, walls, solution };
  }

  const base = { size, checkpoints, walls: [] as Wall[] };
  const walls = pruneRedundantWalls(rng, { ...base, walls: addWallsUntilUnique(rng, base, solutionEdges) });
  // Keep walls in a stable reading order so equal puzzles serialise identically.
  walls.sort((x, y) => edgeKey(x.a, x.b).localeCompare(edgeKey(y.a, y.b)));
  return { size, checkpoints, walls, solution };
}
