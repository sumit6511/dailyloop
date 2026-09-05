import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vite only reads .env files from its own root (this folder) by default;
  // pointing it at the repo root lets every app share one .env file.
  envDir: path.resolve(__dirname, "../../"),
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently starting on the next free port — a
    // silent fallback here once meant the dev server was actually on 5174 while everyone kept
    // opening 5173 (a different, unrelated project) and hitting confusing, unrelated errors.
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
