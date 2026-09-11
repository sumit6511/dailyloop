import { Prisma, type DailyPuzzle } from "@prisma/client";
import { dateKeyToJSDate } from "@dailyloop/shared";
import { getGameModule } from "@dailyloop/game-engine";
import { prisma } from "../lib/prisma.js";

export async function nextPuzzleNumber(gameId: string): Promise<number> {
  return (await prisma.dailyPuzzle.count({ where: { gameId } })) + 1;
}

export type GeneratePuzzleForGameResult =
  | { kind: "created"; puzzle: DailyPuzzle }
  | { kind: "already_exists" }
  | { kind: "no_module" }
  | { kind: "game_not_found" };

/**
 * Generates and persists a game's puzzle for one date, using its real generator — shared by the
 * admin "Generate" button, the on-demand auto-generate fallback, and the cron pre-warm endpoint.
 */
export async function generatePuzzleForGame(
  gameSlug: string,
  dateKey: string,
  opts: { status: "SCHEDULED" | "PUBLISHED"; createdById?: string },
): Promise<GeneratePuzzleForGameResult> {
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) return { kind: "game_not_found" };

  const module = getGameModule(gameSlug);
  if (!module) return { kind: "no_module" };

  const date = dateKeyToJSDate(dateKey);

  // Cap history to the most recent 500 rows (generous vs. even Word Guess's 516-entry bank)
  // rather than an unbounded scan — anything beyond bank size contributes nothing to ranking.
  const history = await prisma.dailyPuzzle.findMany({
    where: { gameId: game.id },
    orderBy: { date: "desc" },
    take: 500,
    select: { content: true },
  });
  const recentlyUsed = module.contentIdentity
    ? history.reverse().flatMap((row) => module.contentIdentity!(row.content))
    : [];

  const content = module.generatePuzzle(`${gameSlug}-${dateKey}`, dateKey, recentlyUsed);

  try {
    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        date,
        puzzleNumber: await nextPuzzleNumber(game.id),
        status: opts.status,
        content: content as Prisma.InputJsonValue,
        createdById: opts.createdById ?? null,
      },
    });
    return { kind: "created", puzzle };
  } catch (err) {
    // Unique constraint race on (gameId, date) — another request generated it concurrently, or
    // an ARCHIVED row already occupies this date. Either way, "already exists" is the right
    // answer rather than propagating a raw DB error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { kind: "already_exists" };
    }
    throw err;
  }
}
