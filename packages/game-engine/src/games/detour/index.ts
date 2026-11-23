import { z } from "zod";
import type { DailyGameModule, ValidationResult } from "../../types.js";
import { buildScoreBreakdown, speedBonus } from "../../scoring.js";
import { createRng, hashSeed, randInt } from "../../rng.js";
import { wallKey, type Cell, type Wall } from "./board.js";
import { chooseAction } from "./bot.js";
import {
  applyAction,
  createState,
  goalRow,
  isLegalAction,
  legalWalls,
  type DetourAction,
  type DetourState,
  type Side,
  type WallOwner,
} from "./game.js";
import { generateStones } from "./generator.js";

export interface DetourContent {
  size: number;
  wallsEach: number;
  stones: Wall[];
  /** Feeds the bot's tie-breaks, so equal-looking choices don't play out the same every day. */
  botSeed: number;
}

export type DetourMove = DetourAction | { type: "resign" };

export interface DetourTurn {
  player: DetourMove;
  /** Null when the player's move ended the game before the bot could reply. */
  bot: DetourAction | null;
}

export interface DetourResult {
  won: boolean;
  winner: Side | null;
  resigned: boolean;
  /** Accepted player turns, the finishing one included. */
  turns: number;
  wallsUsed: number;
  /** Route lengths left at the end — the bot's is the winning margin, the player's how close a loss was. */
  playerDistance: number;
  botDistance: number;
}

const BOARD_SIZE = 7;
const WALLS_EACH = 6;
/**
 * A safety net, not a rule anyone should hit: every bot turn either shortens its route or
 * spends one of a finite stock of walls, so real games finish in ~10–30 turns. The cap only
 * stops a player from shuffling back and forth to grow the move log forever.
 */
export const MAX_TURNS = 80;

const intSchema = z.number().int().min(0).max(BOARD_SIZE);
const wallSchema = z.object({ orientation: z.enum(["h", "v"]), row: intSchema, col: intSchema });

interface Replay {
  state: DetourState;
  history: DetourTurn[];
  validation: ValidationResult<DetourResult>;
}

/**
 * Rebuilds the whole game from the player's move log, exactly like every other game's replay.
 * Only the player's moves are ever stored: the bot is deterministic, so its reply to each
 * accepted move is recomputed here every time and can never drift from what the player saw.
 * Illegal or out-of-turn moves (a blocked step, a wall that seals someone in, a move after the
 * game ended) are ignored without penalty — the board UI only offers legal ones, so these are
 * stale-tab races, not misplays.
 */
function replay(content: DetourContent, moves: DetourMove[]): Replay {
  const state = createState({
    size: content.size,
    wallsEach: content.wallsEach,
    stones: content.stones,
  });
  const history: DetourTurn[] = [];
  let resigned = false;
  let timedOut = false;

  for (const move of moves) {
    if (state.winner || resigned || timedOut) break;

    if (move.type === "resign") {
      resigned = true;
      state.winner = "bot";
      history.push({ player: move, bot: null });
      break;
    }

    if (!isLegalAction(state, "player", move)) continue;
    applyAction(state, "player", move);

    let reply: DetourAction | null = null;
    if (!state.winner) {
      reply = chooseAction(state, "bot", content.botSeed, history.length);
      applyAction(state, "bot", reply);
    }
    history.push({ player: move, bot: reply });

    if (!state.winner && history.length >= MAX_TURNS) timedOut = true;
  }

  const playerDistance = state.grid.distanceTo(state.pawns.player, goalRow(state.size, "player"));
  const botDistance = state.grid.distanceTo(state.pawns.bot, goalRow(state.size, "bot"));
  if (timedOut) state.winner = playerDistance < botDistance ? "player" : "bot";

  const won = state.winner === "player";
  const complete = state.winner !== null;
  const wallsUsed = content.wallsEach - state.wallsLeft.player;
  return {
    state,
    history,
    validation: {
      won,
      complete,
      mistakes: 0,
      result: {
        won,
        winner: state.winner,
        resigned,
        turns: history.length,
        wallsUsed,
        playerDistance,
        botDistance,
      },
    },
  };
}

interface PlacedWall extends Wall {
  owner: WallOwner;
}

function placedWalls(state: DetourState): PlacedWall[] {
  return state.grid.walls.map((wall) => ({
    ...wall,
    owner: state.owners.get(wallKey(wall)) ?? "stone",
  }));
}

export const detourGame: DailyGameModule<DetourContent, DetourMove, DetourResult> = {
  id: "detour",
  name: "Detour",
  description: "Race the bot across the board — drop walls to send it the long way round.",
  icon: "🧱",
  difficulty: "medium",

  contentSchema: z.object({
    size: z.number().int().min(5).max(11),
    wallsEach: z.number().int().min(0).max(20),
    stones: z.array(wallSchema),
    botSeed: z.number().int(),
  }) as z.ZodType<DetourContent>,

  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("step"), row: intSchema, col: intSchema }),
    z.object({
      type: z.literal("wall"),
      orientation: z.enum(["h", "v"]),
      row: intSchema,
      col: intSchema,
    }),
    z.object({ type: z.literal("resign") }),
  ]) as z.ZodType<DetourMove>,

  generatePuzzle(_seed, dateKey) {
    const rng = createRng(`detour-${dateKey}`);
    const pairs = randInt(rng, 1, 3);
    return {
      size: BOARD_SIZE,
      wallsEach: WALLS_EACH,
      stones: generateStones(rng, BOARD_SIZE, pairs),
      botSeed: hashSeed(`detour-bot-${dateKey}`),
    };
  },

  validateAttempt(content, moves) {
    return replay(content, moves).validation;
  },

  calculateScore(_content, result, meta) {
    if (result.won) {
      return buildScoreBreakdown({
        base: 60,
        // The bot's leftover route is the winning margin — a blowout scores more than a photo finish.
        accuracyBonus: Math.min(30, result.botDistance * 6),
        speedBonus: speedBonus(meta.durationMs, 60_000, 360_000, 10),
      });
    }
    // A close loss still earns something; resigning or getting routed earns nothing.
    if (result.resigned) return buildScoreBreakdown({ base: 0 });
    return buildScoreBreakdown({ base: Math.max(0, 25 - result.playerDistance * 5) });
  },

  sanitizeForClient(content, attempt) {
    const { state, history, validation } = replay(content, attempt?.moves ?? []);
    const complete = attempt?.status === "COMPLETED";
    const playing = !complete && !validation.complete;
    const player = state.pawns.player;
    const bot = state.pawns.bot;
    return {
      size: content.size,
      wallsEach: content.wallsEach,
      walls: placedWalls(state),
      player,
      bot,
      wallsLeft: state.wallsLeft,
      playerRoute: state.grid.shortestPath(player, goalRow(state.size, "player")),
      botRoute: state.grid.shortestPath(bot, goalRow(state.size, "bot")),
      legalSteps: playing ? state.grid.pawnMoves(player, bot) : [],
      legalWalls: playing ? legalWalls(state, "player").map(wallKey) : [],
      lastTurn: history[history.length - 1] ?? null,
      turns: history.length,
      complete,
      ...(complete
        ? {
            won: validation.won,
            resigned: validation.result.resigned,
            wallsUsed: validation.result.wallsUsed,
            playerDistance: validation.result.playerDistance,
            botDistance: validation.result.botDistance,
          }
        : {}),
    };
  },
};

export type { Cell, Wall };
