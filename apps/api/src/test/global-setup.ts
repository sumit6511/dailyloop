import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

/**
 * Runs once before the API test files. Each file cleans up after its own tests, but rows left
 * behind by something else — an interrupted run, or the end-to-end seed, which shares this
 * database locally — would collide with a test's fixtures (a seeded "harry", today's puzzles).
 * So start from empty tables. Refuses to touch any database that isn't named as a test one.
 */
export default async function setup(): Promise<void> {
  config({ path: path.resolve(import.meta.dirname, "../../.env.test") });
  const url = process.env.DATABASE_URL ?? "";
  const database = new URL(url).pathname.slice(1);
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to empty "${database}": the API tests only run on a test database.`);
  }
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
