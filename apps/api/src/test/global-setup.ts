import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

/**
 * Runs once before the API test files. Each file cleans up after its own tests, but rows left
 * behind by something else — an interrupted run, or the end-to-end seed, which shares this
 * database locally — would collide with a test's fixtures (a seeded "harry", today's puzzles).
 * So start from empty tables.
 *
 * The URL comes straight from .env.test, never from process.env: importing @prisma/client loads
 * the repo's .env (the dev database) into process.env, and an "empty every table" step must not
 * be able to pick that up. It also refuses any database not named as a test one.
 */
export default async function setup(): Promise<void> {
  const testEnv = parse(readFileSync(path.resolve(import.meta.dirname, "../../.env.test")));
  const url = testEnv.DATABASE_URL ?? "";
  const database = new URL(url).pathname.slice(1);
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to empty "${database}": the API tests only run on a test database.`);
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      const list = tables.map((t) => `"${t.tablename}"`).join(", ");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
