import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Several apps/api test files share one real Postgres instance and clean up with
    // unfiltered deleteMany() between tests — file-level parallelism causes one file's
    // cleanup to delete rows a concurrently-running file is still using mid-request.
    // Project-level `fileParallelism: false` (apps/api/vitest.config.ts) isn't enough
    // to serialize this on its own — it has to also be set here, at the root.
    fileParallelism: false,
    projects: [
      "apps/web/vite.config.ts",
      "apps/api/vitest.config.ts",
      "packages/game-engine/vitest.config.ts",
      "packages/shared/vitest.config.ts",
    ],
  },
});
