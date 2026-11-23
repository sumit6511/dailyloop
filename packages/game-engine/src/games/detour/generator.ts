import { randInt } from "../../rng.js";
import { WallGrid, UNREACHABLE, type Wall } from "./board.js";
import { goalRow, startPosition } from "./game.js";

/** The same wall turned 180° about the board's centre — swaps the player's and bot's views. */
export function rotateWall(wall: Wall, size: number): Wall {
  return { orientation: wall.orientation, row: size - 2 - wall.row, col: size - 2 - wall.col };
}

/**
 * Picks the day's neutral "stone" walls in 180°-symmetric pairs, so whatever the layout, the
 * player's and the bot's journeys are mirror images of each other — no day is lopsided. Stones
 * stay off the two wall rows right in front of the start lines, so neither pawn opens boxed in.
 */
export function generateStones(rng: () => number, size: number, pairs: number): Wall[] {
  const grid = new WallGrid(size);
  const stones: Wall[] = [];
  const playerStart = startPosition(size, "player");
  const botStart = startPosition(size, "bot");
  const straightRoute = size - 1;

  for (let attempt = 0; attempt < 200 && stones.length < pairs * 2; attempt++) {
    const wall: Wall = {
      orientation: rng() < 0.6 ? "h" : "v",
      row: randInt(rng, 1, size - 3),
      col: randInt(rng, 0, size - 2),
    };
    const mirror = rotateWall(wall, size);
    if (!grid.fitsGeometrically(wall)) continue;
    grid.place(wall);
    if (!grid.fitsGeometrically(mirror)) {
      grid.remove(wall);
      continue;
    }
    grid.place(mirror);

    const playerRoute = grid.distanceTo(playerStart, goalRow(size, "player"));
    const botRoute = grid.distanceTo(botStart, goalRow(size, "bot"));
    // Some detour is the point; a maze is not — keep the opening race short and readable.
    if (playerRoute >= UNREACHABLE || botRoute >= UNREACHABLE || playerRoute > straightRoute + 2) {
      grid.remove(mirror);
      grid.remove(wall);
      continue;
    }
    stones.push(wall, mirror);
  }
  return stones;
}
