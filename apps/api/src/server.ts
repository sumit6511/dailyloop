import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { syncAchievementCatalog } from "./services/achievements.js";
import { registerGracefulShutdown } from "./lib/shutdown.js";

const app = await buildApp();
// New achievements ship in code; make sure their rows exist before anyone can earn them.
await syncAchievementCatalog(prisma);

registerGracefulShutdown(app, () => prisma.$disconnect());

try {
  const address = await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`DailyLoop API listening at ${address}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
