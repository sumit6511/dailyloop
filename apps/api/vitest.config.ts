import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
