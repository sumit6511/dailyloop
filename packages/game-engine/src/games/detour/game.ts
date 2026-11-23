import { WallGrid, sameCell, wallKey, type Cell, type Wall } from "./board.js";

export type Side = "player" | "bot";
export type WallOwner = Side | "stone";

export type DetourAction =
  | { type: "step"; row: number; col: number }
  | { type: "wall"; orientation: "h" | "v"; row: number; col: number };

export interface DetourSetup {
  size: number;
  wallsEach: number;
  /** Neutral walls already on the board when the day starts. */
  stones: Wall[];
}

export interface DetourState {
  size: number;
  grid: WallGrid;
  pawns: Record<Side, Cell>;
  wallsLeft: Record<Side, number>;
  owners: Map<string, WallOwner>;
  winner: Side | null;
}

export function goalRow(size: number, side: Side): number {
  return side === "player" ? 0 : size - 1;
}

export function opponentOf(side: Side): Side {
  return side === "player" ? "bot" : "player";
}

export function startPosition(size: number, side: Side): Cell {
  const middle = Math.floor(size / 2);
  return side === "player" ? { row: size - 1, col: middle } : { row: 0, col: middle };
}

export function createState(setup: DetourSetup): DetourState {
  const owners = new Map<string, WallOwner>();
  for (const stone of setup.stones) owners.set(wallKey(stone), "stone");
  return {
    size: setup.size,
    grid: new WallGrid(setup.size, setup.stones),
    pawns: { player: startPosition(setup.size, "player"), bot: startPosition(setup.size, "bot") },
    wallsLeft: { player: setup.wallsEach, bot: setup.wallsEach },
    owners,
    winner: null,
  };
}

/** Both pawns' "from here to my goal" pairs, in a fixed [side, opponent] order. */
export function routesFor(state: DetourState, side: Side) {
  const other = opponentOf(side);
  return [
    { from: state.pawns[side], goalRow: goalRow(state.size, side) },
    { from: state.pawns[other], goalRow: goalRow(state.size, other) },
  ];
}

export function isLegalAction(state: DetourState, side: Side, action: DetourAction): boolean {
  if (state.winner) return false;
  if (action.type === "step") {
    const target = { row: action.row, col: action.col };
    return state.grid
      .pawnMoves(state.pawns[side], state.pawns[opponentOf(side)])
      .some((m) => sameCell(m, target));
  }
  if (state.wallsLeft[side] <= 0) return false;
  return state.grid.tryWall(action, routesFor(state, side)) !== null;
}

/** Applies an action already known to be legal (see isLegalAction) and settles a win. */
export function applyAction(state: DetourState, side: Side, action: DetourAction): void {
  if (action.type === "step") {
    state.pawns[side] = { row: action.row, col: action.col };
    if (action.row === goalRow(state.size, side)) state.winner = side;
    return;
  }
  const wall: Wall = { orientation: action.orientation, row: action.row, col: action.col };
  state.grid.place(wall);
  state.owners.set(wallKey(wall), side);
  state.wallsLeft[side]--;
}

export function legalWalls(state: DetourState, side: Side): Wall[] {
  if (state.winner || state.wallsLeft[side] <= 0) return [];
  const routes = routesFor(state, side);
  return state.grid.allWallSlots().filter((slot) => state.grid.tryWall(slot, routes) !== null);
}
