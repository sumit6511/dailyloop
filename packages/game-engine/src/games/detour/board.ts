/**
 * Detour's board rules — pure, framework-free, and shared by the replay, the bot, and the
 * generator. Coordinates: `row` 0 is the top edge, `col` 0 the left edge.
 *
 * A wall is two cells long and sits on a grid intersection: `{orientation, row, col}` with
 * row/col in [0, size-2]. A horizontal wall at (r, c) lies between rows r and r+1, spanning
 * columns c and c+1; a vertical wall at (r, c) lies between columns c and c+1, spanning rows r
 * and r+1. Two walls may touch end to end but never overlap or cross through each other's middle.
 */

export interface Cell {
  row: number;
  col: number;
}

export type Orientation = "h" | "v";

export interface Wall {
  orientation: Orientation;
  row: number;
  col: number;
}

export const UNREACHABLE = 10_000;

export function wallKey(wall: Wall): string {
  return `${wall.orientation}${wall.row}-${wall.col}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

const DIRECTIONS: ReadonlyArray<Cell> = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

/**
 * Mutable wall layout with O(1) edge lookups. Kept mutable on purpose: the bot evaluates every
 * candidate wall by placing it, measuring both routes, and removing it again, which is far
 * cheaper than copying the board ~70 times per turn.
 */
export class WallGrid {
  readonly size: number;
  /** blockedDown[r*size+c]: the edge between (r,c) and (r+1,c) is walled. */
  private readonly blockedDown: Uint8Array;
  /** blockedRight[r*size+c]: the edge between (r,c) and (r,c+1) is walled. */
  private readonly blockedRight: Uint8Array;
  private readonly placed = new Set<string>();
  private readonly queue: Int16Array;
  private readonly distance: Int16Array;

  constructor(size: number, walls: readonly Wall[] = []) {
    this.size = size;
    this.blockedDown = new Uint8Array(size * size);
    this.blockedRight = new Uint8Array(size * size);
    this.queue = new Int16Array(size * size);
    this.distance = new Int16Array(size * size);
    for (const wall of walls) this.place(wall);
  }

  get walls(): Wall[] {
    return [...this.placed].map(parseWallKey);
  }

  has(wall: Wall): boolean {
    return this.placed.has(wallKey(wall));
  }

  inBounds(cell: Cell): boolean {
    return cell.row >= 0 && cell.row < this.size && cell.col >= 0 && cell.col < this.size;
  }

  /** In range, and doesn't overlap or cross an existing wall. Says nothing about routes. */
  fitsGeometrically(wall: Wall): boolean {
    const max = this.size - 2;
    if (!Number.isInteger(wall.row) || !Number.isInteger(wall.col)) return false;
    if (wall.row < 0 || wall.row > max || wall.col < 0 || wall.col > max) return false;
    const { row, col } = wall;
    if (this.placed.has(`h${row}-${col}`) || this.placed.has(`v${row}-${col}`)) return false;
    if (wall.orientation === "h") {
      return !this.placed.has(`h${row}-${col - 1}`) && !this.placed.has(`h${row}-${col + 1}`);
    }
    return !this.placed.has(`v${row - 1}-${col}`) && !this.placed.has(`v${row + 1}-${col}`);
  }

  place(wall: Wall): void {
    this.setEdges(wall, 1);
    this.placed.add(wallKey(wall));
  }

  remove(wall: Wall): void {
    this.setEdges(wall, 0);
    this.placed.delete(wallKey(wall));
  }

  private setEdges(wall: Wall, value: 0 | 1): void {
    const { row, col } = wall;
    const s = this.size;
    if (wall.orientation === "h") {
      this.blockedDown[row * s + col] = value;
      this.blockedDown[row * s + col + 1] = value;
    } else {
      this.blockedRight[row * s + col] = value;
      this.blockedRight[(row + 1) * s + col] = value;
    }
  }

  /** True if a wall sits between two orthogonally adjacent cells. */
  isBlocked(a: Cell, b: Cell): boolean {
    const s = this.size;
    if (a.col === b.col) {
      const top = Math.min(a.row, b.row);
      return this.blockedDown[top * s + a.col] === 1;
    }
    const left = Math.min(a.col, b.col);
    return this.blockedRight[a.row * s + left] === 1;
  }

  /**
   * Distance (in single steps, ignoring pawns) from every cell to the nearest cell of
   * `goalRow` — one multi-source BFS answers "how far is anyone from that goal" for the whole
   * board. Unreachable cells read UNREACHABLE. Returns a fresh array the caller may keep.
   */
  distanceMap(goalRow: number): Int16Array {
    const s = this.size;
    const dist = new Int16Array(s * s).fill(UNREACHABLE);
    const queue = this.queue;
    let head = 0;
    let tail = 0;
    for (let col = 0; col < s; col++) {
      const index = goalRow * s + col;
      dist[index] = 0;
      queue[tail++] = index;
    }
    while (head < tail) {
      const index = queue[head++]!;
      const row = Math.floor(index / s);
      const col = index % s;
      const next = dist[index]! + 1;
      if (row > 0 && this.blockedDown[index - s] === 0 && dist[index - s]! > next) {
        dist[index - s] = next;
        queue[tail++] = index - s;
      }
      if (row < s - 1 && this.blockedDown[index] === 0 && dist[index + s]! > next) {
        dist[index + s] = next;
        queue[tail++] = index + s;
      }
      if (col > 0 && this.blockedRight[index - 1] === 0 && dist[index - 1]! > next) {
        dist[index - 1] = next;
        queue[tail++] = index - 1;
      }
      if (col < s - 1 && this.blockedRight[index] === 0 && dist[index + 1]! > next) {
        dist[index + 1] = next;
        queue[tail++] = index + 1;
      }
    }
    return dist;
  }

  /** Shortest route length from `from` to any cell of `goalRow`, ignoring pawns. */
  distanceTo(from: Cell, goalRow: number): number {
    // Single-source BFS with an early exit — cheaper than a full map when only one answer is
    // needed, which is the hot path when the bot scores ~70 candidate walls.
    const s = this.size;
    const start = from.row * s + from.col;
    if (from.row === goalRow) return 0;
    const dist = this.distance;
    dist.fill(-1);
    const queue = this.queue;
    let head = 0;
    let tail = 0;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++]!;
      const row = Math.floor(index / s);
      const col = index % s;
      const next = dist[index]! + 1;
      const visit = (target: number): boolean => {
        if (dist[target] !== -1) return false;
        if (Math.floor(target / s) === goalRow) return true;
        dist[target] = next;
        queue[tail++] = target;
        return false;
      };
      if (row > 0 && this.blockedDown[index - s] === 0 && visit(index - s)) return next;
      if (row < s - 1 && this.blockedDown[index] === 0 && visit(index + s)) return next;
      if (col > 0 && this.blockedRight[index - 1] === 0 && visit(index - 1)) return next;
      if (col < s - 1 && this.blockedRight[index] === 0 && visit(index + 1)) return next;
    }
    return UNREACHABLE;
  }

  /** One concrete shortest route (start cell first), for drawing — deterministic. */
  shortestPath(from: Cell, goalRow: number): Cell[] {
    const dist = this.distanceMap(goalRow);
    const s = this.size;
    if (dist[from.row * s + from.col]! >= UNREACHABLE) return [];
    // Prefer heading straight toward the goal when several neighbours tie, so the drawn route
    // reads naturally instead of zig-zagging.
    const towardGoal = goalRow < from.row ? -1 : 1;
    const order: Cell[] = [
      { row: towardGoal, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
      { row: -towardGoal, col: 0 },
    ];
    const path: Cell[] = [from];
    let current = from;
    while (dist[current.row * s + current.col]! > 0) {
      const here = dist[current.row * s + current.col]!;
      let stepped = false;
      for (const d of order) {
        const next = { row: current.row + d.row, col: current.col + d.col };
        if (!this.inBounds(next) || this.isBlocked(current, next)) continue;
        if (dist[next.row * s + next.col] === here - 1) {
          path.push(next);
          current = next;
          stepped = true;
          break;
        }
      }
      if (!stepped) break; // unreachable in practice: a BFS distance always has a predecessor
    }
    return path;
  }

  /**
   * Every square `pawn` may step to this turn, given the other pawn at `other`. One orthogonal
   * step; or, when the other pawn is directly adjacent with no wall between, a straight jump
   * over it — and if a wall or the board edge sits right behind it, a diagonal hop to either
   * side of it instead.
   */
  pawnMoves(pawn: Cell, other: Cell): Cell[] {
    const moves: Cell[] = [];
    for (const d of DIRECTIONS) {
      const next = { row: pawn.row + d.row, col: pawn.col + d.col };
      if (!this.inBounds(next) || this.isBlocked(pawn, next)) continue;
      if (!sameCell(next, other)) {
        moves.push(next);
        continue;
      }
      const jump = { row: next.row + d.row, col: next.col + d.col };
      if (this.inBounds(jump) && !this.isBlocked(next, jump)) {
        moves.push(jump);
        continue;
      }
      const sides: Cell[] =
        d.row === 0
          ? [
              { row: -1, col: 0 },
              { row: 1, col: 0 },
            ]
          : [
              { row: 0, col: -1 },
              { row: 0, col: 1 },
            ];
      for (const side of sides) {
        const diagonal = { row: next.row + side.row, col: next.col + side.col };
        if (this.inBounds(diagonal) && !this.isBlocked(next, diagonal)) moves.push(diagonal);
      }
    }
    return moves;
  }

  /** Every intersection slot, both orientations, in a fixed order. */
  allWallSlots(): Wall[] {
    const slots: Wall[] = [];
    for (let row = 0; row <= this.size - 2; row++) {
      for (let col = 0; col <= this.size - 2; col++) {
        slots.push({ orientation: "h", row, col }, { orientation: "v", row, col });
      }
    }
    return slots;
  }

  /**
   * Fits, and leaves both pawns at least one route to their goal row. When it's legal, also
   * reports the two new route lengths, since every caller that asks wants them next anyway.
   */
  tryWall(wall: Wall, routes: ReadonlyArray<{ from: Cell; goalRow: number }>): number[] | null {
    if (!this.fitsGeometrically(wall)) return null;
    this.place(wall);
    const lengths: number[] = [];
    let legal = true;
    for (const route of routes) {
      const length = this.distanceTo(route.from, route.goalRow);
      if (length >= UNREACHABLE) {
        legal = false;
        break;
      }
      lengths.push(length);
    }
    this.remove(wall);
    return legal ? lengths : null;
  }
}

export function parseWallKey(key: string): Wall {
  const orientation = key[0] === "h" ? "h" : "v";
  const [row, col] = key.slice(1).split("-").map(Number);
  return { orientation, row: row!, col: col! };
}
