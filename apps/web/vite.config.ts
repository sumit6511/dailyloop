import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envDir = path.resolve(__dirname, "../../");

/** NODE_ENV as set in the .env files Vite will load for this mode (later files win). */
function nodeEnvFromEnvFiles(mode: string): string | undefined {
  let value: string | undefined;
  for (const name of [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`]) {
    const file = path.join(envDir, name);
    if (fs.existsSync(file)) value = parseEnv(fs.readFileSync(file, "utf8")).NODE_ENV ?? value;
  }
  return value;
}

export default defineConfig(({ command, mode }) => {
  // The repo-root .env is shared with the API. If it sets NODE_ENV to anything but "production",
  // Vite applies it to the build after this config runs, which silently bundles React's
  // development build (~1.7x larger, slower). Fail loudly instead.
  const fromEnvFile = nodeEnvFromEnvFiles(mode);
  if (command === "build" && fromEnvFile && fromEnvFile !== "production") {
    throw new Error(
      `.env sets NODE_ENV=${fromEnvFile}, which would make this production build bundle React's ` +
        "development build. Remove NODE_ENV from .env (the API defaults to development).",
    );
  }
  return config;
});

const config = {
  plugins: [react(), tailwindcss()],
  // Vite only reads .env files from its own root (this folder) by default;
  // pointing it at the repo root lets every app share one .env file.
  envDir,
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
};
