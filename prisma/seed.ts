import { PrismaClient, type User, type Prisma } from "@prisma/client";
import argon2 from "argon2";
import { registerAllGames, getGameModule } from "@dailyloop/game-engine";
import { getTodayKey, addDaysToKey, dateKeyToJSDate, ACHIEVEMENT_CATALOG } from "@dailyloop/shared";

const prisma = new PrismaClient();

// Dev-only credentials. Documented here and in the README; must be changed
// (or removed) before this schema is ever pointed at a production database.
const DEV_ADMIN = {
  email: "admin@dailyloop.dev",
  username: "admin",
  displayName: "DailyLoop Admin",
  password: "DevAdmin123!",
};

const DEMO_PASSWORD = "DemoPass123!";
const DEMO_USERS = [
  { email: "harry@dailyloop.dev", username: "harry", displayName: "Harry" },
  { email: "sumit@dailyloop.dev", username: "sumit", displayName: "Sumit" },
  { email: "aayush@dailyloop.dev", username: "aayush", displayName: "Aayush" },
  { email: "sagar@dailyloop.dev", username: "sagar", displayName: "Sagar" },
];

async function upsertUser(input: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role?: "USER" | "ADMIN";
}): Promise<User> {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash,
      role: input.role ?? "USER",
    },
  });
  await prisma.streak.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  return user;
}

async function befriend(idA: string, idB: string): Promise<void> {
  const userAId = idA < idB ? idA : idB;
  const userBId = idA < idB ? idB : idA;
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });
}

const GAMES = [
  {
    slug: "connections",
    name: "Connections",
    description: "Group 16 words into four hidden categories.",
    icon: "🟩",
    difficulty: "medium",
    sortOrder: 0,
  },
  {
    slug: "word-guess",
    name: "Word Guess",
    description: "Guess the daily word in six tries.",
    icon: "🟨",
    difficulty: "medium",
    sortOrder: 1,
  },
  {
    slug: "number-puzzle",
    name: "Number Puzzle",
    description: "Reach the target using numbers and operators.",
    icon: "🔢",
    difficulty: "medium",
    sortOrder: 2,
  },
  {
    slug: "logic-puzzle",
    name: "Logic Puzzle",
    description: "Solve a daily 6×6 mini logic grid.",
    icon: "🧠",
    difficulty: "hard",
    sortOrder: 3,
  },
  {
    slug: "guess-it",
    name: "Guess It",
    description: "Identify the mystery answer from four clues.",
    icon: "🎯",
    difficulty: "easy",
    sortOrder: 4,
  },
];

async function seedGames() {
  const rows = [];
  for (const game of GAMES) {
    rows.push(await prisma.game.upsert({ where: { slug: game.slug }, update: game, create: game }));
  }
  console.log(`${GAMES.length} games ready: ${GAMES.map((g) => g.slug).join(", ")}`);
  return rows;
}

const PUZZLE_HISTORY_DAYS = 29; // + today = 30 days of published history
const PUZZLE_FUTURE_DAYS = 5; // scheduled, not yet published

/** Only seeds puzzles for games that actually have a generatePuzzle implementation. */
async function seedPuzzles(games: { id: string; slug: string }[]): Promise<void> {
  const todayKey = getTodayKey();

  for (const game of games) {
    const module = getGameModule(game.slug);
    if (!module) continue;

    let created = 0;
    let puzzleNumber = (await prisma.dailyPuzzle.count({ where: { gameId: game.id } })) + 1;

    for (let offset = -PUZZLE_HISTORY_DAYS; offset <= PUZZLE_FUTURE_DAYS; offset++) {
      const dateKey = addDaysToKey(todayKey, offset);
      const date = dateKeyToJSDate(dateKey);
      const existing = await prisma.dailyPuzzle.findUnique({ where: { gameId_date: { gameId: game.id, date } } });
      if (existing) continue;

      const content = module.generatePuzzle(`${game.slug}-${dateKey}`, dateKey);
      await prisma.dailyPuzzle.create({
        data: {
          gameId: game.id,
          date,
          puzzleNumber: puzzleNumber++,
          status: offset <= 0 ? "PUBLISHED" : "SCHEDULED",
          content: content as Prisma.InputJsonValue,
        },
      });
      created++;
    }
    console.log(`${game.slug}: ${created} puzzles created (${PUZZLE_HISTORY_DAYS + 1} published, ${PUZZLE_FUTURE_DAYS} scheduled)`);
  }
}

async function seedAchievements(): Promise<void> {
  for (const achievement of ACHIEVEMENT_CATALOG) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: achievement,
      create: achievement,
    });
  }
  console.log(`${ACHIEVEMENT_CATALOG.length} achievements ready`);
}

async function main() {
  console.log("Seeding DailyLoop...\n");
  registerAllGames();

  const admin = await upsertUser({ ...DEV_ADMIN, role: "ADMIN" });
  console.log(`Admin ready: ${admin.email}`);

  const demoUsers: User[] = [];
  for (const demo of DEMO_USERS) {
    demoUsers.push(await upsertUser({ ...demo, password: DEMO_PASSWORD }));
  }
  console.log(`${demoUsers.length} demo users ready: ${demoUsers.map((u) => u.username).join(", ")}`);

  // Befriend every demo user with every other one so the leaderboard isn't empty on first login.
  for (let i = 0; i < demoUsers.length; i++) {
    for (let j = i + 1; j < demoUsers.length; j++) {
      const a = demoUsers[i];
      const b = demoUsers[j];
      if (a && b) await befriend(a.id, b.id);
    }
  }
  console.log("Demo friendships ready");

  const games = await seedGames();
  await seedPuzzles(games);
  await seedAchievements();

  console.log("\nDev credentials (local only — see README before deploying anywhere real):");
  console.log(`  Admin      ${DEV_ADMIN.email} / ${DEV_ADMIN.password}`);
  console.log(`  Demo users harry / sumit / aayush / sagar @dailyloop.dev, password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
