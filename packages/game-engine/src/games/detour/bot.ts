import { hashSeed } from "../../rng.js";
import { UNREACHABLE, wallKey, type Cell, type Wall } from "./board.js";
import {
  goalRow,
  opponentOf,
  routesFor,
  type DetourAction,
  type DetourState,
  type Side,
} from "./game.js";

export interface BotPolicy {
  /**
   * Losing a pure race and a wall only matches a step's gain: wall anyway. Walls compound —
   * the second wall beside a first one costs far more than either alone — so a bot that only
   * ever walls for an immediate net profit never builds a barrier and loses to anyone who
   * just walks.
   */
  wallOnTieWhenBehind: boolean;
  /** At or below this race margin (opponent's route minus mine), consider walling at all. */
  contestMargin: number;
  /** Opportunistic: wall whenever one beats a step by at least this much, whatever the margin. */
  bigWallEdge: number;
  /** How many of the top immediate walls get a one-wall lookahead for follow-up potential. */
  lookahead: number;
}

export const DEFAULT_BOT_POLICY: BotPolicy = {
  wallOnTieWhenBehind: true,
  contestMargin: -1,
  bigWallEdge: 3,
  lookahead: 6,
};

interface WallCandidate {
  wall: Wall;
  /** Net race swing: how much longer their route got minus how much longer mine got. */
  gain: number;
  theirIncrease: number;
  proximity: number;
  tie: number;
  value: number;
}

function tieBreak(seed: number, turn: number, key: string): number {
  return hashSeed(`${seed}:${turn}:${key}`);
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** Distance from a wall's centre to a pawn, in half-cells — closer walls tend to bite sooner. */
function wallProximity(wall: Wall, pawn: Cell): number {
  const centreRow = wall.row + 0.5;
  const centreCol = wall.col + 0.5;
  return Math.abs(centreRow - pawn.row) + Math.abs(centreCol - pawn.col);
}

function compareCandidates(a: WallCandidate, b: WallCandidate): number {
  return (
    b.value - a.value ||
    b.gain - a.gain ||
    b.theirIncrease - a.theirIncrease ||
    a.proximity - b.proximity ||
    a.tie - b.tie
  );
}

/**
 * The opponent the player races against. Deterministic by construction — it reads nothing but
 * the board, the seed, and the turn number — which is what lets the server rebuild an entire
 * game from the player's move log alone (the bot's replies are recomputed, never stored).
 *
 * Each turn it compares the best step (how much closer it gets) against every legal wall (how
 * much the wall swings the race: their detour minus its own), and only spends a wall when that
 * beats walking — or, when it's behind, when a wall at least ties a step, since a wall now sets
 * up bigger walls later while a step that leaves it still losing buys nothing.
 */
export function chooseAction(
  state: DetourState,
  side: Side,
  seed: number,
  turn: number,
  policy: BotPolicy = DEFAULT_BOT_POLICY,
): DetourAction {
  const other = opponentOf(side);
  const me = state.pawns[side];
  const them = state.pawns[other];
  const myGoal = goalRow(state.size, side);
  const theirGoal = goalRow(state.size, other);
  const grid = state.grid;

  const myMap = grid.distanceMap(myGoal);
  const at = (cell: Cell) => myMap[cell.row * state.size + cell.col]!;
  const steps = grid.pawnMoves(me, them);

  const winning = steps.find((step) => step.row === myGoal);
  if (winning) return { type: "step", row: winning.row, col: winning.col };

  let bestStep = steps[0]!;
  for (const step of steps.slice(1)) {
    const diff = at(step) - at(bestStep);
    if (diff < 0) bestStep = step;
    else if (diff === 0) {
      // Prefer the square farther from the opponent's pawn (fewer jump-overs gifted to it),
      // then a seeded coin flip so ties don't always resolve the same way every day.
      const spacing = manhattan(bestStep, them) - manhattan(step, them);
      if (
        spacing > 0 ||
        (spacing === 0 &&
          tieBreak(seed, turn, `${step.row}-${step.col}`) <
            tieBreak(seed, turn, `${bestStep.row}-${bestStep.col}`))
      ) {
        bestStep = step;
      }
    }
  }
  const stepAction: DetourAction = { type: "step", row: bestStep.row, col: bestStep.col };
  if (state.wallsLeft[side] <= 0) return stepAction;

  const myDistance = at(me);
  const theirDistance = grid.distanceTo(them, theirGoal);
  const stepGain = myDistance - at(bestStep);
  // I'm to move, so in a pure race I arrive first when my route is no longer than theirs.
  const margin = theirDistance - myDistance;

  const candidates: WallCandidate[] = [];
  const routes = routesFor(state, other); // [their route, my route]
  for (const wall of grid.allWallSlots()) {
    const lengths = grid.tryWall(wall, routes);
    if (!lengths) continue;
    const theirIncrease = lengths[0]! - theirDistance;
    const myIncrease = lengths[1]! - myDistance;
    const gain = theirIncrease - myIncrease;
    if (gain <= 0) continue;
    candidates.push({
      wall,
      gain,
      theirIncrease,
      proximity: wallProximity(wall, them),
      tie: tieBreak(seed, turn, wallKey(wall)),
      value: gain,
    });
  }
  if (candidates.length === 0) return stepAction;
  candidates.sort(compareCandidates);

  // A shallow look one wall further for the most promising few: a wall that's only a tie now
  // but opens a big follow-up (the start of a barrier) beats an equal one that leads nowhere.
  if (policy.lookahead > 0 && state.wallsLeft[side] > 1) {
    for (const candidate of candidates.slice(0, policy.lookahead)) {
      grid.place(candidate.wall);
      const baseThem = theirDistance + candidate.theirIncrease;
      const baseMe = myDistance + candidate.theirIncrease - candidate.gain;
      let followUp = 0;
      for (const next of grid.allWallSlots()) {
        const lengths = grid.tryWall(next, routes);
        if (!lengths) continue;
        const swing = lengths[0]! - baseThem - (lengths[1]! - baseMe);
        if (swing > followUp) followUp = swing;
      }
      grid.remove(candidate.wall);
      candidate.value = candidate.gain + followUp * 0.5;
    }
    candidates.sort(compareCandidates);
  }

  const best = candidates[0]!;
  const wallAction: DetourAction = { type: "wall", ...best.wall };
  const edge = best.gain - stepGain;

  if (theirDistance >= UNREACHABLE) return stepAction;
  if (edge >= policy.bigWallEdge) return wallAction;
  if (margin < 0 || margin <= policy.contestMargin) {
    if (edge > 0) return wallAction;
    if (edge === 0 && margin < 0 && policy.wallOnTieWhenBehind) return wallAction;
  }
  return stepAction;
}
